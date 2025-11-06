import { MoonLoader } from 'react-spinners'

function Loader() {
    const spinner = (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            width: '100%',
            marginBottom: 16,
        }}>
            <MoonLoader size={30} color="#202121" />
        </div>
    )

    return (
        <div className="loader">
            {spinner}
        </div>
    )
}

export default Loader