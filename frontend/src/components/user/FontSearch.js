import React from "react";
import { Button, CircularProgress, TextField } from "@mui/material";

const FontSearch = ({ reaction, setReaction, onSearchFont, loading }) => (
    <>
        <TextField
            label="Введите реакцию"
            variant="outlined"
            value={reaction}
            onChange={(e) => setReaction(e.target.value)}
            sx={{ mb: 2, width: "100%" }}
        />
        <Button
            variant="contained"
            color="primary"
            onClick={onSearchFont}
            fullWidth
            disabled={loading}
            sx={{ mb: 2 }}
        >
            {loading ? <CircularProgress size={24} color="inherit" /> : "Найти шрифт"}
        </Button>
    </>
);

export default FontSearch;
