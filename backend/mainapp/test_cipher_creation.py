import unittest
import random
import time 
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

class FontInteractionGUITest(unittest.TestCase):

    def setUp(self):
        self.driver = webdriver.Chrome() 
        self.driver.implicitly_wait(5) 
        self.base_url = "https://frontend-jws9.onrender.com"
        self.test_user = {"username": "alexclass98", "password": "a89852325782"} 

        print("\nВыполняется setUp для FontInteractionGUITest...")
        self.driver.get(f"{self.base_url}/login")
        
        WebDriverWait(self.driver, 10).until(EC.presence_of_element_located((By.NAME, "username"))).send_keys(self.test_user["username"])
        WebDriverWait(self.driver, 10).until(EC.presence_of_element_located((By.NAME, "password"))).send_keys(self.test_user["password"])
        
        login_button_locator = (By.XPATH, "//button[@type='submit' and (contains(., 'Войти') or contains(., 'Login'))]")
        WebDriverWait(self.driver, 10).until(EC.element_to_be_clickable(login_button_locator)).click()
        
        print("Кнопка 'Войти' нажата. Ожидание результата логина...")

        expected_url_after_login = f"{self.base_url}/"
        start_research_button_locator = (By.XPATH, "//a[contains(@href, '/test') and normalize-space()='Начать исследование']")

        try:
            WebDriverWait(self.driver, 15).until(EC.url_to_be(expected_url_after_login))
            print(f"Редирект на {expected_url_after_login} выполнен.")
            
            WebDriverWait(self.driver, 10).until(
                EC.visibility_of_element_located(start_research_button_locator)
            )
            print("Кнопка 'Начать исследование' найдена и видима. Логин успешен.")
            
            login_buttons = self.driver.find_elements(By.XPATH, "//a[contains(@href, '/login') and normalize-space()='Войти']")
            self.assertEqual(len(login_buttons), 0, "Кнопка 'Войти' все еще присутствует на странице после логина.")
            print("Кнопка 'Войти' отсутствует, как и ожидалось.")

        except TimeoutException:
            print("!!! ОШИБКА ЛОГИНА или НЕ НАЙДЕНА КНОПКА 'Начать исследование' / НЕ ПРОИЗОШЕЛ РЕДИРЕКТ !!!")
            print(f"Текущий URL: {self.driver.current_url}")
            self.driver.save_screenshot("login_error_screenshot.png")
            raise 
        
        print("Логин для GUI теста выполнен успешно.")

    def test_font_test_page_interaction(self):
        print("\n--- Тест GUI: Взаимодействие на странице Тестирования шрифтов ---")
        driver = self.driver

        print("Шаг 1: Нажатие кнопки 'Начать исследование'...")
        start_research_button_locator = (By.XPATH, "//a[contains(@href, '/test') and normalize-space()='Начать исследование']")
        try:
            start_research_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable(start_research_button_locator)
            )
            start_research_button.click()
            WebDriverWait(driver, 15).until(
                EC.visibility_of_element_located((By.XPATH, "//h1[normalize-space()='Тестирование шрифтов']"))
            )
            print(f"Переход на страницу 'Тестирование шрифтов' выполнен. Текущий URL: {driver.current_url}")
        except TimeoutException:
            print("!!! TimeoutException: Не удалось нажать 'Начать исследование' или перейти на страницу Тестирования шрифтов !!!")
            driver.save_screenshot("error_navigate_to_font_test_page.png")
            raise
        
        print("Шаг 2: Ожидание загрузки первого варианта шрифта...")
        
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
                    # print(f"Проверка текста информации о вариации: '{text_content}'") 
                    return element.is_displayed() and text_content != "(Загрузка...)" and "LS:" in text_content and "SZ:" in text_content and "LH:" in text_content
                except NoSuchElementException:
                    # print(f"Элемент информации о вариации по XPath '{variation_info_locator_xpath}' пока не найден...")
                    return False
            
            print(f"Ожидание, пока информация о вариации загрузится (XPath: {variation_info_locator_xpath})...")
            WebDriverWait(driver, 25).until(variation_data_is_loaded_and_valid)

            final_variation_info_text = driver.find_element(By.XPATH, variation_info_locator_xpath).text.strip()
            print(f"Информация о вариации шрифта окончательно загружена: {final_variation_info_text}")
            self.assertNotIn("Загрузка...", final_variation_info_text, "Информация о шрифте все еще 'Загрузка...'")
            self.assertTrue("LS:" in final_variation_info_text and "SZ:" in final_variation_info_text and "LH:" in final_variation_info_text, "Ключевые маркеры LS:, SZ:, LH: не найдены в информации о вариации")

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
            driver.save_screenshot("error_font_test_initial_load.png")
            print(f"Текущий URL в момент ошибки: {driver.current_url}")
            raise

        reaction_text = f"Это моя тестовая реакция на шрифт {random.randint(1,100)}"
        print(f"Шаг 3: Ввод реакции: '{reaction_text}'")
        driver.find_element(*reaction_input_locator).send_keys(reaction_text)

        next_button_locator = (By.XPATH, "//button[normalize-space()='Ответить и продолжить']")
        try:
            next_button = WebDriverWait(driver, 10).until(EC.element_to_be_clickable(next_button_locator))
            
            question_progress_locator = (By.XPATH, "//*[contains(@class, 'MuiTypography-subtitle1') and contains(text(), 'Вопрос')]")
            current_question_text_before = WebDriverWait(driver,10).until(EC.visibility_of_element_located(question_progress_locator)).text
            print(f"Текущий вопрос перед кликом: {current_question_text_before}")
            
            next_button.click()
            print("Нажата кнопка 'Ответить и продолжить'.")
        except TimeoutException:
            print("!!! TimeoutException: Кнопка 'Ответить и продолжить' не найдена или не кликабельна !!!")
            driver.save_screenshot("error_font_test_next_button.png")
            raise

        print("Шаг 4: Ожидание загрузки следующего варианта шрифта...")
        try:
            WebDriverWait(driver, 20).until(
                lambda d: d.find_element(*question_progress_locator).text != current_question_text_before or \
                          EC.visibility_of_element_located((By.XPATH, "//h5[contains(text(), 'Тестирование завершено!')]"))(d)
            )
            
            try:
                finish_message = driver.find_element(By.XPATH, "//h5[contains(text(), 'Тестирование завершено!')]")
                print(f"Тестирование завершено раньше времени: {finish_message.text}")
            except NoSuchElementException:
                new_question_text_after = driver.find_element(*question_progress_locator).text
                print(f"Загружен следующий вопрос: {new_question_text_after}")
                self.assertNotEqual(current_question_text_before, new_question_text_after, "Номер вопроса не изменился")
                
                reaction_input_value_after = driver.find_element(*reaction_input_locator).get_attribute("value")
                self.assertEqual(reaction_input_value_after, "", "Поле реакции не очистилось")
                print("Поле реакции успешно очищено.")

        except TimeoutException:
            print("!!! TimeoutException: Не удалось загрузить следующий вариант шрифта или индикатор вопроса не обновился !!!")
            driver.save_screenshot("error_font_test_next_load.png")
            raise
            
        print("Тест взаимодействия со страницей тестирования шрифтов успешно пройден (1 цикл).")

    def tearDown(self):
        self.driver.quit()
        print("Выполнен tearDown, браузер закрыт.")

if __name__ == "__main__":
    unittest.main(verbosity=2)