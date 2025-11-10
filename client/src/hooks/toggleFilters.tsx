import { useState, useEffect } from 'react';

export function useToggleFilters() {
    const [showFilters, setShowFilters] = useState<boolean | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth <= 860;
            setIsMobile(mobile);
            setShowFilters(!mobile);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const toggleFilters = () => {
        if (isMobile) setShowFilters(prev => !prev);
    };

    return {
        showFilters: showFilters ?? true,
        toggleFilters,
        isMobile,
    };
}