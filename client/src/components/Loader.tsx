interface LoaderProps {
    size?: number
    color?: string
    inline?: boolean
}

function Loader({ size = 30, color = 'var(--text-color)', inline = false }: LoaderProps) {
    const wrapStyle: React.CSSProperties = inline
        ? { display: 'inline-flex', alignItems: 'center' }
        : {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            width: '100%',
            marginBottom: 0,
        }

    const svgStyle: React.CSSProperties = {
        animation: 'tea-leaf-spin 1.4s linear infinite',
        color,
        transformOrigin: 'center',
        display: 'block',
    }

    return (
        <div style={wrapStyle} role="status" aria-label="Loading">
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                style={svgStyle}
                aria-hidden="true"
            >
                <path
                    d="M12 2 C 7.5 5.5, 6 12, 12 22 C 18 12, 16.5 5.5, 12 2 Z"
                    fill="currentColor"
                    opacity="0.85"
                />
                <path
                    d="M12 4 C 13 9, 13 15, 12 20"
                    stroke="var(--bg-color, #fff)"
                    strokeWidth="0.9"
                    strokeLinecap="round"
                    opacity="0.45"
                    fill="none"
                />
            </svg>
        </div>
    )
}

export default Loader
