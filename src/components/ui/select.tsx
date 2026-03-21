import * as React from "react"

export const Select = ({ value, onChange, options }: { value: string, onChange: (val: string) => void, options: {label: string, value: string}[] }) => {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
            <option value="" style={{ color: 'black' }}>All Projects</option>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value} style={{ color: 'black' }}>{opt.label}</option>
            ))}
        </select>
    )
}
