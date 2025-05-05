import React from "react";
import { TextField } from "@mui/material";

const UserSearch = ({ search, onSearchChange }) => (
    <TextField
        label="Поиск по пользователям"
        variant="outlined"
        value={search}
        onChange={onSearchChange}
        sx={{ mb: 2, width: "100%" }}
    />
);

export default UserSearch;
