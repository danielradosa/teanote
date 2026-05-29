import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { t } from 'i18next'
import type { Tea } from '@/types/Tea'

interface PieChartProps {
    teas: Tea[]
}

interface CustomLabelProps {
    x?: number
    y?: number
    value?: number
    name?: string
}

const TEA_COLORS: Record<string, string> = {
    green: '#9BD77D',
    white: '#e8e8e8ff',
    black: '#C86B2A',
    oolong: '#A28D5B',
    sheng: '#C9D67C',
    shou: '#4A2F1B',
    yellow: '#F4D36B',
    purple: '#8B6F9C',
}

function TeaTypePieChart({ teas }: PieChartProps) {
    const counts = teas.reduce<Record<string, number>>((acc, tea) => {
        acc[tea.type] = (acc[tea.type] || 0) + 1
        return acc
    }, {})

    const data = Object.entries(counts).map(([type, count]) => ({
        name: type,
        value: count,
    }))

    const CustomLabel = (props: CustomLabelProps) => {
        const { x = 0, y = 0, value, name = '' } = props
        const translated = t(`tea_tag_${name}`)
        const label = `${translated} (${value})`

        return (
            <g>
                <rect
                    x={x - 30}
                    y={y - 12}
                    width={label.length * 7.5}
                    height={22}
                    rx={4}
                    ry={4}
                    fill="rgba(30, 30, 30, 0.7)"
                />
                <text
                    x={x - 21.5}
                    y={y}
                    fill={TEA_COLORS[name]}
                    fontSize={14}
                    dominantBaseline="middle"
                >
                    {label}
                </text>
            </g>
        )
    }

    return (
        <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        label={<CustomLabel />}
                    >
                        {data.map((item) => (
                            <Cell
                                key={item.name}
                                fill={TEA_COLORS[item.name] ?? '#ccc'}
                            />
                        ))}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}

export default TeaTypePieChart
