import * as React from "react"
import { cn } from "@/lib/utils"

export function Tooltip({ children, text }: { children: React.ReactNode, text: string }) {
    const [isVisible, setIsVisible] = React.useState(false)

    return (
        <div
            className="relative inline-block"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div className="absolute z-10 w-48 px-2 py-1 text-sm text-center text-white bg-black rounded-lg shadow-lg bottom-full left-1/2 -translate-x-1/2 -translate-y-2">
                    {text}
                    <svg className="absolute text-black h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255" xmlSpace="preserve"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
                </div>
            )}
        </div>
    )
}
