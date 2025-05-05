import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { Snackbar, Alert } from "@mui/material";
import { clearError } from "../store/errorSlice";

const ErrorSnackbar = () => {
    const dispatch = useDispatch();
    const errorMessage = useSelector((state) => state.error.message);
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        if (errorMessage) {
            setOpen(true);
        }
    }, [errorMessage]);

    const handleClose = () => {
        setOpen(false);
        dispatch(clearError());
    };

    return (
        <Snackbar
            open={open}
            autoHideDuration={4000}
            onClose={handleClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
            <Alert onClose={handleClose} severity="error" sx={{ width: "100%" }}>
                {errorMessage}
            </Alert>
        </Snackbar>
    );
};

export default ErrorSnackbar;
