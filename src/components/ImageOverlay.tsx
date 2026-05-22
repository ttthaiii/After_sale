import React, { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageOverlayProps {
    src: string;
    isOpen: boolean;
    onClose: () => void;
    alt?: string;

    // Premium image gallery slider support!
    images?: { url: string; label: string }[];
    currentIndex?: number;
    onIndexChange?: (index: number) => void;
}

const ImageOverlay: React.FC<ImageOverlayProps> = ({
    src,
    isOpen,
    onClose,
    alt = "Image View",
    images = [],
    currentIndex = 0,
    onIndexChange
}) => {
    const isGallery = images && images.length > 0 && onIndexChange !== undefined;
    const currentUrl = isGallery ? images[currentIndex]?.url : src;
    const currentLabel = isGallery ? images[currentIndex]?.label : alt;

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            } else if (isGallery && onIndexChange) {
                if (event.key === 'ArrowRight') {
                    const nextIdx = (currentIndex + 1) % images.length;
                    onIndexChange(nextIdx);
                } else if (event.key === 'ArrowLeft') {
                    const prevIdx = (currentIndex - 1 + images.length) % images.length;
                    onIndexChange(prevIdx);
                }
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose, isGallery, currentIndex, images.length, onIndexChange]);

    if (!isOpen) return null;

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isGallery && onIndexChange) {
            const prevIdx = (currentIndex - 1 + images.length) % images.length;
            onIndexChange(prevIdx);
        }
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isGallery && onIndexChange) {
            const nextIdx = (currentIndex + 1) % images.length;
            onIndexChange(nextIdx);
        }
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99999,
                backdropFilter: 'blur(12px)',
                cursor: 'pointer',
                animation: 'fadeIn 0.2s ease-out'
            }}
        >
            <style>
                {`
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes zoomIn {
                        from { transform: scale(0.95); opacity: 0; }
                        to { transform: scale(1); opacity: 1; }
                    }
                `}
            </style>

            {/* Top Bar for Close and Count */}
            <div style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                right: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pointerEvents: 'none',
                zIndex: 2
            }}>
                {isGallery && (
                    <div style={{
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        backgroundColor: 'rgba(15, 23, 42, 0.6)',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)'
                    }}>
                        ภาพที่ {currentIndex + 1} / {images.length}
                    </div>
                )}
                <div style={{ marginLeft: 'auto', pointerEvents: 'auto' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '50%',
                            width: '44px',
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={e => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                            e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseOut={e => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* Left Control Arrow */}
            {isGallery && (
                <button
                    onClick={handlePrev}
                    style={{
                        position: 'absolute',
                        left: '20px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '50%',
                        width: '56px',
                        height: '56px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        zIndex: 2
                    }}
                    onMouseOver={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                        e.currentTarget.style.transform = 'scale(1.08)';
                    }}
                    onMouseOut={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    <ChevronLeft size={32} />
                </button>
            )}

            {/* Main Content Area */}
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    maxWidth: '85vw',
                    maxHeight: '85vh',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'zoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
                }}
            >
                <img
                    loading="lazy"
                    src={currentUrl}
                    alt={currentLabel}
                    style={{
                        maxWidth: '100%',
                        maxHeight: '75vh',
                        borderRadius: '16px',
                        objectFit: 'contain',
                        border: '2px solid rgba(255, 255, 255, 0.15)'
                    }}
                />
                
                {currentLabel && (
                    <div style={{
                        marginTop: '16px',
                        color: '#ffffff',
                        fontSize: '1rem',
                        fontWeight: 900,
                        backgroundColor: 'rgba(15, 23, 42, 0.8)',
                        padding: '8px 24px',
                        borderRadius: '24px',
                        backdropFilter: 'blur(8px)',
                        border: '1.5px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                        letterSpacing: '0.5px'
                    }}>
                        {currentLabel}
                    </div>
                )}
            </div>

            {/* Right Control Arrow */}
            {isGallery && (
                <button
                    onClick={handleNext}
                    style={{
                        position: 'absolute',
                        right: '20px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '50%',
                        width: '56px',
                        height: '56px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        zIndex: 2
                    }}
                    onMouseOver={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                        e.currentTarget.style.transform = 'scale(1.08)';
                    }}
                    onMouseOut={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    <ChevronRight size={32} />
                </button>
            )}
        </div>
    );
};

export default ImageOverlay;
