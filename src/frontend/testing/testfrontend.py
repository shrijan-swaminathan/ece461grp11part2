# use selenium
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.keys import Keys
import time

service = Service(executable_path='./chromedriver.exe')  # Update path if necessary

# Initialize the WebDriver with the Service
driver = webdriver.Chrome(service=service)

# Navigate to the frontend URL
driver.get("http://3.140.252.124/")

def test_url_input():
    # Locate the URL input section
    url_input_section = driver.find_element(By.ID, 'urlInputSection')
    npm_url_input = driver.find_element(By.ID, 'npmPackageURL')

    # Ensure the URL input section is visible when 'url' method is selected
    driver.find_element(By.ID, 'uploadURL').click()
    assert url_input_section.is_displayed()

    # Enter an NPM package URL
    npm_url_input.send_keys('https://github.com/karma-runner/karma')

    # Optionally submit the form or check for actions like validation
    submit_button = driver.find_element(By.XPATH, '//button[text()="Upload"]')
    submit_button.click()

    # Wait for result or validation message
    time.sleep(20)

    # Check if URL was processed
    upload_result = driver.find_element(By.ID, 'uploadResult')
    print(upload_result.text)

test_url_input()