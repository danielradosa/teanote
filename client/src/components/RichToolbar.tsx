import React from 'react'

interface RichToolbarProps {
    value: string
    setValue: (value: string) => void
    textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const RichToolbar: React.FC<RichToolbarProps> = ({ value, setValue, textareaRef }) => {
    function insertAround(before: string, after: string) {
        const textarea = textareaRef.current
        if (!textarea) return
        const { selectionStart, selectionEnd, value: fieldValue } = textarea
        const selected = fieldValue.slice(selectionStart, selectionEnd)
        const newValue =
            fieldValue.slice(0, selectionStart) +
            before +
            selected +
            after +
            fieldValue.slice(selectionEnd)
        setValue(newValue)
        setTimeout(() => {
            textarea.focus()
            textarea.setSelectionRange(
                selectionStart + before.length,
                selectionEnd + before.length
            )
        }, 0)
    }
    function insertLines(prefix: string) {
        const textarea = textareaRef.current
        if (!textarea) return
        const { selectionStart, selectionEnd, value: fieldValue } = textarea
        const selected = fieldValue.slice(selectionStart, selectionEnd)
        const lines = selected.split('\n').map(line => prefix + line).join('\n')
        const newValue =
            fieldValue.slice(0, selectionStart) + lines + fieldValue.slice(selectionEnd)
        setValue(newValue)
        setTimeout(() => {
            textarea.focus()
            textarea.setSelectionRange(
                selectionStart + prefix.length,
                selectionEnd + prefix.length
            )
        }, 0)
    }
    return (
        <div className="format-toolbar">
            <button type="button" onClick={() => insertAround("**", "**")} className='btn btn-action' style={{ fontWeight: 'bold' }}>B</button>
            <button type="button" onClick={() => insertAround("*", "*")} className='btn btn-action' style={{ fontStyle: 'italic' }}>I</button>
            <button type="button" onClick={() => insertAround("## ", "")} className='btn btn-action'>H2</button>
            <button type="button" onClick={() => insertLines("- ")} className='btn btn-action'><i className="bxr bx-list-ul" /> List</button>
            <small>use of markdown is recommended</small>
        </div>
    )
}
export default RichToolbar
