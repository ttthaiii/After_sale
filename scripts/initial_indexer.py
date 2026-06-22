import os
import re
import json
from pathlib import Path

BASE = Path(__file__).parent.parent
INDEX_FILES = BASE / "knowledge/index_files.json"

# Regexes to capture import declarations
IMPORT_RE = re.compile(r"from\s+['\"](\.\.?/[^'\"]+)['\"]|import\s+['\"](\.\.?/[^'\"]+)['\"]")
JSDOC_RE = re.compile(r"/\*\*(.*?)\*/", re.DOTALL)
LINE_COMMENT_RE = re.compile(r"^//\s*(.*)$")

def clean_comment(comment):
    lines = []
    for line in comment.splitlines():
        line = line.strip().lstrip('*').strip()
        if line:
            lines.append(line)
    return " ".join(lines) if lines else None

def get_file_description(file_path, content):
    # Try JSDoc first
    m = JSDOC_RE.search(content)
    if m:
        cleaned = clean_comment(m.group(1))
        if cleaned:
            return cleaned
            
    # Try first line comments
    for line in content.splitlines()[:5]:
        m = LINE_COMMENT_RE.match(line.strip())
        if m:
            return m.group(1).strip()
            
    # Fallback to filename-based description
    name = file_path.name
    parent_dir = file_path.parent.name
    return f"Module or component {name} located in {parent_dir}."

def resolve_import_path(curr_file, import_str):
    # curr_file is a Path object relative to BASE
    curr_dir = curr_file.parent
    candidate_path = (BASE / curr_dir / import_str).resolve()
    
    # Try common typescript/javascript extensions
    for ext in ['.ts', '.tsx', '/index.ts', '/index.tsx']:
        test_path = Path(str(candidate_path) + ext)
        if test_path.is_file():
            return test_path.relative_to(BASE).as_posix()
            
    # Check if directory and check dir index
    if candidate_path.is_dir():
        for ext in ['.ts', '.tsx']:
            test_path_dir = candidate_path / f"index{ext}"
            if test_path_dir.is_file():
                return test_path_dir.relative_to(BASE).as_posix()
                
    # If not resolved but exists without extension
    if candidate_path.is_file():
        return candidate_path.relative_to(BASE).as_posix()
        
    return None

def build_index():
    files_map = {}
    
    # First pass: collect all source files and their descriptions
    source_files = []
    for ext in ['*.ts', '*.tsx']:
        for f in (BASE / "src").rglob(ext):
            rel_path = f.relative_to(BASE).as_posix()
            source_files.append((f, rel_path))
            
    # Also scan cloud functions
    for ext in ['*.ts']:
        for f in (BASE / "cloud-functions").rglob(ext):
            if "node_modules" not in f.parts and "lib" not in f.parts:
                rel_path = f.relative_to(BASE).as_posix()
                source_files.append((f, rel_path))
                
    for f, rel_path in source_files:
        try:
            content = f.read_text(encoding='utf-8')
            desc = get_file_description(f, content)
            files_map[rel_path] = {
                "description": desc,
                "associated_tasks": [],
                "backlinks": []
            }
        except Exception as e:
            print(f"Error reading {rel_path}: {e}")
            
    # Second pass: extract imports and populate backlinks
    for f, rel_path in source_files:
        try:
            content = f.read_text(encoding='utf-8')
            imports = []
            for match in IMPORT_RE.finditer(content):
                val = match.group(1) or match.group(2)
                if val:
                    imports.append(val)
                    
            for imp in imports:
                resolved = resolve_import_path(f.relative_to(BASE), imp)
                if resolved and resolved in files_map:
                    # If this file imports the resolved file, then THIS file (rel_path) is a backlink for the resolved file
                    if rel_path not in files_map[resolved]["backlinks"]:
                        files_map[resolved]["backlinks"].append(rel_path)
        except Exception as e:
            print(f"Error parsing imports for {rel_path}: {e}")
            
    # Save index
    output_data = {"files": files_map}
    INDEX_FILES.parent.mkdir(parents=True, exist_ok=True)
    INDEX_FILES.write_text(json.dumps(output_data, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f"Built index_files.json with {len(files_map)} files indexed.")

if __name__ == "__main__":
    build_index()
