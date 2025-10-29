import React from 'react'
import { marked } from 'marked'

interface MarkdownDisplayProps {
    content: string
}

const MdDisplay: React.FC<MarkdownDisplayProps> = ({ content }) => {
    return (
        <div
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: marked.parse(content || '') }}
        />
    )
}

export default MdDisplay
