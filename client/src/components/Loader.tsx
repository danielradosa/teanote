import { MoonLoader } from 'react-spinners'

interface LoaderProps {
    size?: number
    color?: string
    inline?: boolean
}

function Loader({ size = 30, color = '#202121', inline = false }: LoaderProps) {
    const style: React.CSSProperties = inline
        ? { display: 'inline-flex', alignItems: 'center' }
        : {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            width: '100%',
            marginBottom: 0,
        }

    return (
        <div style={style}>
            <MoonLoader size={size} color={color} />
        </div>
    )
}

export default Loader