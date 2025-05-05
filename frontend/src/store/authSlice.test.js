import authReducer, { setToken, clearToken } from './authSlice';

describe('authSlice', () => {
    const initialState = {
        token: null,
        isAdmin: false,
    };

    beforeEach(() => {
        // Очистка localStorage перед каждым тестом
        localStorage.clear();
    });

    test('should return the initial state', () => {
        expect(authReducer(undefined, { type: undefined })).toEqual(initialState);
    });

    test('should handle setToken action', () => {
        const payload = {
            access: 'mockToken123',
            is_admin: true,
        };

        const expectedState = {
            token: 'mockToken123',
            isAdmin: true,
        };

        const action = setToken(payload);
        const state = authReducer(initialState, action);

        // Проверяем состояние
        expect(state).toEqual(expectedState);

        // Проверяем, что localStorage обновился
        expect(localStorage.getItem('token')).toBe('mockToken123');
        expect(localStorage.getItem('is_admin')).toBe('true');
    });

    test('should handle clearToken action', () => {
        const preloadedState = {
            token: 'mockToken123',
            isAdmin: true,
        };

        const expectedState = {
            token: null,
            isAdmin: false,
        };

        const action = clearToken();
        const state = authReducer(preloadedState, action);

        // Проверяем состояние
        expect(state).toEqual(expectedState);

        // Проверяем, что localStorage очистился
        expect(localStorage.getItem('token')).toBeNull();
        expect(localStorage.getItem('is_admin')).toBeNull();
    });
});
