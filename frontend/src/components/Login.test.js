import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter as Router } from "react-router-dom";
import { Provider } from "react-redux";
import configureStore from "redux-mock-store";
import Login from "./Login";
import { login } from "../api/api";

jest.mock("../api/api", () => ({
  login: jest.fn(),
}));

jest.mock("react-redux", () => ({
  useDispatch: jest.fn(),
}));

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
}));

const mockNavigate = jest.fn();
const mockDispatch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  require("react-router-dom").useNavigate.mockReturnValue(mockNavigate);
  require("react-redux").useDispatch.mockReturnValue(mockDispatch);
});

const renderWithProviders = (ui, { store } = {}) => {
  const mockStoreCreator = configureStore([]);
  const testStore = store || mockStoreCreator({});
  return render(
    <Provider store={testStore}>
      <Router>{ui}</Router>
    </Provider>
  );
};

describe("Login Component", () => {
  test("renders correctly", () => {
    renderWithProviders(<Login />);
    expect(screen.getByText(/Вход/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Пароль/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Войти/i })).toBeInTheDocument();
  });

  test("updates state on input change", () => {
    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/Пароль/i);

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    expect(emailInput.value).toBe("test@example.com");
    expect(passwordInput.value).toBe("password123");
  });

  test("calls login API and dispatches token on success", async () => {
    const mockApiResponse = { token: "mockToken" };
    login.mockResolvedValueOnce(mockApiResponse);

    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/Пароль/i);
    const submitButton = screen.getByRole("button", { name: /Войти/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    expect(login).toHaveBeenCalledWith({
      username: "test@example.com",
      password: "password123",
    });
    await screen.findByText(/Вход/i);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "auth/setToken",
      payload: mockApiResponse,
    });
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  test("handles login error gracefully", async () => {
    login.mockRejectedValueOnce(new Error("Login failed"));

    renderWithProviders(<Login />);

    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/Пароль/i);
    const submitButton = screen.getByRole("button", { name: /Войти/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    expect(login).toHaveBeenCalledWith({
      username: "test@example.com",
      password: "password123",
    });
    await screen.findByText(/Вход/i);

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
