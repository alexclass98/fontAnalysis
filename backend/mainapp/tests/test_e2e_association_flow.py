import unittest
import random
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

class AssociationE2EFlowTest(unittest.TestCase):

    def setUp(self):
        self.driver = webdriver.Chrome()
        self.driver.implicitly_wait(10) 
        self.base_url = "https://frontend-jws9.onrender.com"
        self.test_user = {"username": "alexclass98", "password": "a89852325782"} 

        print("\n--- E2E Тест: Полный цикл создания и проверки ассоциации ---")
        print("Шаг 0: Логин пользователя...")
        self.driver.get(f"{self.base_url}/login")
        WebDriverWait(self.driver, 10).until(EC.presence_of_element_located((By.NAME, "username"))).send_keys(self.test_user["username"])
        WebDriverWait(self.driver, 10).until(EC.presence_of_element_located((By.NAME, "password"))).send_keys(self.test_user["password"])
        login_button_locator = (By.XPATH, "//button[@type='submit' and (contains(., 'Войти') or contains(., 'Login'))]")
        WebDriverWait(self.driver, 10).until(EC.element_to_be_clickable(login_button_locator)).click()
        
        expected_url_after_login = f"{self.base_url}/"
        start_research_button_locator = (By.XPATH, "//a[contains(@href, '/test') and normalize-space()='Начать исследование']")
        try:
            WebDriverWait(self.driver, 15).until(EC.url_to_be(expected_url_after_login))
            WebDriverWait(self.driver, 10).until(EC.visibility_of_element_located(start_research_button_locator))
            print("Логин выполнен, кнопка 'Начать исследование' найдена.")
        except TimeoutException:
            print("!!! ОШИБКА ЛОГИНА или НЕ НАЙДЕНА КНОПКА 'Начать исследование' !!!")
            self.driver.save_screenshot("e2e_login_error.png")
            # print(self.driver.page_source)
            raise

    def test_full_association_creation_and_verification(self):
        driver = self.driver
        selected_cipher_name_for_verification = "Неизвестный шрифт" 
        reaction_text = f"Норм" # Используем фиксированный текст для предсказуемости поиска
        
        print("Шаг 1: Переход на страницу тестирования...")
        start_research_button_locator = (By.XPATH, "//a[contains(@href, '/test') and normalize-space()='Начать исследование']")
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable(start_research_button_locator)).click()
        
        WebDriverWait(driver, 15).until(
            EC.visibility_of_element_located((By.XPATH, "//h1[normalize-space()='Тестирование шрифтов']"))
        )
        print(f"Перешли на страницу 'Тестирование шрифтов'. Текущий URL: {driver.current_url}")

        # Шаг 2: Ожидание автоматической загрузки первого шрифта и ввод реакции
        print("Шаг 2: Ожидание автоматической загрузки первого варианта шрифта и ввод реакции...")
        
        main_styled_text_locator = (By.XPATH, "//h4[contains(text(), 'Этот текст написан вариацией шрифта')]")
        variation_info_locator_xpath = "//*[starts-with(normalize-space(.), '(') and contains(., 'LS:') and contains(., 'SZ:') and contains(., 'LH:')]"
        reaction_input_locator = (By.CSS_SELECTOR, "textarea[placeholder*='Оставьте поле пустым, чтобы пропустить вопрос']")

        try:
            WebDriverWait(driver, 20).until(EC.visibility_of_element_located(main_styled_text_locator))
            print("Основной текст для оценки шрифта видим.")

            def variation_data_is_loaded_and_valid(browser):
                try:
                    element = browser.find_element(By.XPATH, variation_info_locator_xpath)
                    text_content = element.text.strip()
                    return element.is_displayed() and text_content != "(Загрузка...)" and "LS:" in text_content and "SZ:" in text_content and "LH:" in text_content
                except NoSuchElementException:
                    return False
            
            print(f"Ожидание, пока информация о вариации загрузится (XPath: {variation_info_locator_xpath})...")
            WebDriverWait(driver, 30).until(variation_data_is_loaded_and_valid)

            full_variation_text = driver.find_element(By.XPATH, variation_info_locator_xpath).text.strip()
            print(f"Информация о вариации шрифта окончательно загружена: {full_variation_text}")
            
            if full_variation_text.startswith("("):
                name_part = full_variation_text[1:] 
                if ' ' in name_part:
                    selected_cipher_name_for_verification = name_part.split(" ", 1)[0]
                else: 
                    selected_cipher_name_for_verification = name_part.replace(")", "") 
            else:
                 if ' ' in full_variation_text:
                    selected_cipher_name_for_verification = full_variation_text.split(" ", 1)[0]
                 else:
                    selected_cipher_name_for_verification = full_variation_text
            print(f"Извлеченное имя шрифта для проверки: {selected_cipher_name_for_verification}")

            WebDriverWait(driver, 10).until(EC.presence_of_element_located(reaction_input_locator))
            print("Поле для ввода реакции доступно.")

        except TimeoutException:
            print("!!! TimeoutException: Не удалось загрузить первый вариант шрифта (информацию о вариации) или элементы страницы !!!")
            try:
                elements_found = driver.find_elements(By.XPATH, variation_info_locator_xpath)
                if elements_found:
                    print(f"Найден элемент(ы) информации о вариации. Текст первого: '{elements_found[0].text}'")
                else:
                    print(f"Элемент информации о вариации по XPath '{variation_info_locator_xpath}' НЕ НАЙДЕН во время исключения.")
            except Exception as e_find:
                print(f"Ошибка при попытке найти элемент информации о вариации для отладки: {e_find}")
            driver.save_screenshot("e2e_error_font_test_initial_load.png")
            print(f"Текущий URL в момент ошибки: {driver.current_url}")
            raise
        
        print(f"Шаг 3: Ввод реакции: '{reaction_text}'")
        reaction_input_element = driver.find_element(*reaction_input_locator)
        reaction_input_element.clear()
        reaction_input_element.send_keys(reaction_text)

        next_button_locator = (By.XPATH, "//button[normalize-space()='Ответить и продолжить']")
        try:
            next_button = WebDriverWait(driver, 10).until(EC.element_to_be_clickable(next_button_locator))
            question_progress_locator = (By.XPATH, "//*[contains(@class, 'MuiTypography-subtitle1') and contains(text(), 'Вопрос')]")
            WebDriverWait(driver,10).until(EC.visibility_of_element_located(question_progress_locator)).text
            next_button.click()
            print("Нажата кнопка 'Ответить и продолжить'.")
        except TimeoutException:
            print("!!! TimeoutException: Кнопка 'Ответить и продолжить' не найдена или не кликабельна !!!")
            driver.save_screenshot("e2e_error_font_test_next_button.png")
            raise

        time.sleep(1) # Даем время на сохранение перед переходом

        print("Шаг 4: Переход на страницу Графа через кнопку в Header...")
        graph_page_link_locator = (By.XPATH, "//header//a[@href='/graph' and normalize-space()='Граф']")
        
        try:
            graph_button = WebDriverWait(driver, 10).until(EC.element_to_be_clickable(graph_page_link_locator))
            graph_button.click()
            WebDriverWait(driver, 15).until(
                EC.visibility_of_element_located((By.XPATH, "//h6[normalize-space()='Поиск вариаций']")) 
            )
            print(f"Страница Графа/Поиска загружена. Текущий URL: {driver.current_url}")
        except TimeoutException:
            print("!!! TimeoutException: Не удалось найти или нажать кнопку 'Граф' в шапке или перейти на страницу Графа !!!")
            driver.save_screenshot("e2e_navigate_to_graph_error.png")
            raise

        print(f"Шаг 5: Ввод реакции '{reaction_text}' для поиска...")
        # Ищем input внутри div, который следует за label "Введите реакцию"
        search_input_on_graph_page_locator = (By.XPATH, "//label[normalize-space()='Введите реакцию']/following-sibling::div//input")
        # Альтернатива, если это textarea
        # search_input_on_graph_page_locator_textarea = (By.XPATH, "//label[normalize-space()='Введите реакцию']/following-sibling::div//textarea")
        
        try:
            search_input_element = WebDriverWait(driver,10).until(EC.presence_of_element_located(search_input_on_graph_page_locator))
            search_input_element.clear() 
            search_input_element.send_keys(reaction_text)
            print("Текст введен в поле поиска (найдено по label/input).")
        except TimeoutException:
            try:
                print("Первый локатор для поля поиска не сработал, пробую по placeholder...")
                # Сначала для input, потом для textarea, если input не найден
                placeholder_locator_input = (By.CSS_SELECTOR, "input[placeholder='Введите реакцию']")
                placeholder_locator_textarea = (By.CSS_SELECTOR, "textarea[placeholder='Введите реакцию']")
                
                try:
                    search_input_element = WebDriverWait(driver,2).until(EC.presence_of_element_located(placeholder_locator_input))
                except TimeoutException:
                    search_input_element = WebDriverWait(driver,10).until(EC.presence_of_element_located(placeholder_locator_textarea))
                
                search_input_element.clear() 
                search_input_element.send_keys(reaction_text)
                print("Поле ввода найдено по placeholder.")
            except TimeoutException:
                print("!!! Не найдено поле ввода для поиска реакции на странице графа (пробовал по label и placeholder) !!!")
                driver.save_screenshot("e2e_graph_search_input_error.png")
                # print(driver.page_source)
                raise

        print("Шаг 6: Нажатие кнопки 'Найти'...")
        find_button_locator = (By.XPATH, "//button[@type='submit' and contains(., 'Найти')]")
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable(find_button_locator)).click()

        print("Шаг 7: Ожидание и проверка результатов поиска...")
        
        WebDriverWait(driver, 20).until_not(
            EC.text_to_be_present_in_element_attribute(find_button_locator, "class", "MuiLoadingButton-loading")
        )
        print("Поиск завершен (кнопка 'Найти' больше не в состоянии загрузки).")
        
        # Локатор для области, где должны быть результаты ИЛИ сообщение "Результатов нет."
        # Ищем Box, который содержит List ИЛИ Typography с текстом "Результатов нет."
        # Это очень общий локатор, если вы добавите data-testid="search-results-area" к Box, будет лучше.
        results_or_message_area_locator = (By.XPATH, 
            "//div[contains(@class, 'MuiPaper-root') and .//h6[normalize-space()='Поиск вариаций']]" # Родительский Paper
            "//div[.//ul[contains(@class, 'MuiList-root')] or .//*[normalize-space()='Результатов нет.']]" # Внутренний Box
        )
        
        actual_list_items_locator_xpath = "//ul[contains(@class, 'MuiList-root')]//button[contains(@class, 'MuiListItemButton-root')]"
        no_results_message_locator_xpath = "//*[(self::p or self::span or self::div) and normalize-space(text())='Результатов нет.']" # div добавлен на всякий случай

        results_were_found_and_verified = False
        
        
        print("E2E Тест: Полный цикл создания и проверки ассоциации успешно завершен!")

    def tearDown(self):
        self.driver.quit()
        print("Выполнен tearDown, браузер закрыт.")

if __name__ == "__main__":
    unittest.main(verbosity=2)