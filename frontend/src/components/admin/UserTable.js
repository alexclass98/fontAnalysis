import React from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Button } from "@mui/material";

const UserTable = ({ users, onDeleteUser, loading, search }) => {
    const filteredUsers = users.filter(
        (user) =>
            user.username.toLowerCase().includes(search.toLowerCase()) ||
            (user.first_name && user.first_name.toLowerCase().includes(search.toLowerCase())) ||
            (user.last_name && user.last_name.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div style={{ height: 400, width: "100%" }}>
            <DataGrid
                rows={filteredUsers}
                columns={[
                    { field: "id", headerName: "ID", width: 100 },
                    { field: "username", headerName: "Имя пользователя", width: 200 },
                    { field: "first_name", headerName: "Имя", width: 150 },
                    { field: "last_name", headerName: "Фамилия", width: 150 },
                    {
                        field: "actions",
                        headerName: "Действия",
                        width: 150,
                        renderCell: (params) => (
                            <Button
                                variant="outlined"
                                color="error"
                                onClick={() => onDeleteUser(params.row.id)}
                            >
                                Удалить
                            </Button>
                        ),
                    },
                ]}
                pageSize={5}
                rowsPerPageOptions={[5]}
                loading={loading}
                disableSelectionOnClick
            />
        </div>
    );
};

export default UserTable;
