import React from "react"

interface SearchProps {
    value: string
    setValue: (value: string) => void
    placeholder?: string
}

const SearchBar: React.FC<SearchProps> = ({ value, setValue, placeholder }) => {
    return (
        <input
            type="search"
            name="filter_search"
            id="filter_search"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder || "Search…"}
        />
    );
};

export default SearchBar