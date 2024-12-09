# use selenium
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.keys import Keys
import time
import sys


def test_url_input(driver, packageurl):
    # Locate the URL input section
    url_input_section = driver.find_element(By.ID, 'urlInputSection')
    npm_url_input = driver.find_element(By.ID, 'npmPackageURL')

    # Ensure the URL input section is visible when 'url' method is selected
    driver.find_element(By.ID, 'uploadURL').click()
    assert url_input_section.is_displayed()

    # Enter an NPM package URL
    npm_url_input.send_keys(packageurl)

    # Optionally submit the form or check for actions like validation
    submit_button = driver.find_element(By.XPATH, '//button[text()="Upload"]')
    submit_button.click()

    # Wait for result or validation message
    time.sleep(40)

    # Check if URL was processed
    upload_result = driver.find_element(By.ID, 'uploadResult')
    print(upload_result.text)

def test_download_package(driver, packageName, packageVersion):
    # Locate the download section elements
    module_name_input = driver.find_element(By.ID, 'downloadModuleName')
    module_version_input = driver.find_element(By.ID, 'downloadModuleVersion')

    # Enter module name and version
    module_name_input.send_keys(packageName)
    module_version_input.send_keys(packageVersion)

    # Click the Download button
    download_button = driver.find_element(By.XPATH, '//button[text()="Download Package"]')
    download_button.click()

    # Wait for result or validation message
    time.sleep(20)

    # Check if the download result is displayed
    download_result = driver.find_element(By.ID, 'downloadResult')
    print(download_result.text)

def test_search_modules_all(driver):
        # Locate the input fields for module name and version
        search_name_input = driver.find_element(By.ID, 'searchName')

        search_name_input.send_keys('*')

        # Click the Search button
        search_button = driver.find_element(By.XPATH, '//button[text()="Search"]')
        search_button.click()

        # Wait for search results to load
        time.sleep(10)

        package_items = driver.find_elements(By.CSS_SELECTOR, '#searchResults .package-item2')
        print(str(len(package_items)) + ' package(s) found')

def test_search_modules_specific(driver, packageName, packageVersionrange):
        # Locate the input fields for module name and version
        search_name_input = driver.find_element(By.ID, 'searchName')
        search_version_input = driver.find_element(By.ID, 'searchVersion')

        search_name_input.send_keys(packageName)
        search_version_input.send_keys(packageVersionrange)

        # Click the Search button
        search_button = driver.find_element(By.XPATH, '//button[text()="Search"]')
        search_button.click()

        # Wait for search results to load
        time.sleep(10)

        package_items = driver.find_elements(By.CSS_SELECTOR, '#searchResults .package-item2')
        print(str(len(package_items)) + ' package(s) found')

def test_fetch_ratings(driver, packageName, packageVersion):
    # Locate the input fields for module name and version
    search_name_input = driver.find_element(By.ID, 'rateModuleName')
    search_version_input = driver.find_element(By.ID, 'rateModuleVersion')

    search_name_input.send_keys(packageName)
    search_version_input.send_keys(packageVersion)

    # Click the Search button
    search_button = driver.find_element(By.XPATH, '//button[text()="Get Rating"]')
    search_button.click()

    # Wait for ratings to load
    time.sleep(10)

    # Check if ratings are displayed
    ratings = driver.find_elements(By.CSS_SELECTOR, '#ratingResults .rating-item')
    scores = []
    latencies = []

    # Loop through each rating item to extract the score and latency
    score_names = []
    for item in ratings:
        score = item.find_element(By.CSS_SELECTOR, '.score').text
        score_names.append(item.find_element(By.TAG_NAME, 'h4').text)
        latency = item.find_element(By.TAG_NAME, 'small').text
        scores.append(score)
        latencies.append(latency)

    # Print the fetched ratings and latencies
    for i in range(len(scores)):
        print(f"{score_names[i]}: {scores[i]}, {latencies[i]}")

'''
Note: This code requires a valid chromedriver.exe file in the same directory as this file.
User Input Options are: UploadURL, Download, SearchAll, SearchSpecific, Rate.
For each option:
    - UploadURL: Requires a URL to be provided as an argument
    - Download: Requires a package name and version to be provided as arguments
    - SearchAll: Requires no arguments
    - SearchSpecific: Requires a package name and version range to be provided as arguments
    - Rate: Requires a package name and version to be provided as arguments
'''
if __name__ == '__main__':
    # take in CLI arguments
    if len(sys.argv) == 1:
        print("Please provide a valid user input option: UploadURL, Download, SearchAll, SearchSpecific, Rate")
        sys.exit(1)
    user_input = sys.argv[1]
    if user_input not in ['UploadURL', 'Download', 'SearchAll', 'SearchSpecific', 'Rate']:
        print("Please provide a valid user input option: UploadURL, Download, SearchAll, SearchSpecific, Rate")
        sys.exit(1)
    if (user_input == 'UploadURL' and len(sys.argv) != 3) or (user_input == 'Download' and len(sys.argv) != 4) or (user_input == 'SearchSpecific' and len(sys.argv) != 4) or (user_input == 'Rate' and len(sys.argv) != 4):
        print("Please provide the necessary arguments for the user input option")
        sys.exit(1)
    service = Service(executable_path='./chromedriver.exe')  # Update path if necessary
    # Initialize the WebDriver with the Service
    driver = webdriver.Chrome(service=service)
    # Navigate to the frontend URL
    driver.get("http://3.140.252.124/")
    if user_input == 'UploadURL':
        packageurl = sys.argv[2]
        test_url_input(driver)

    elif user_input == 'Download':
        packageName = sys.argv[2]
        packageVersion = sys.argv[3]
        test_download_package(driver, packageName, packageVersion)

    elif user_input == 'SearchAll':
        test_search_modules_all(driver)

    elif user_input == 'SearchSpecific':
        packageName = sys.argv[2]
        packageVersionrange = sys.argv[3]
        test_search_modules_specific(driver, packageName, packageVersionrange)

    elif user_input == 'Rate':
        packageName = sys.argv[2]
        packageVersion = sys.argv[3]
        test_fetch_ratings(driver, packageName, packageVersion)
    driver.quit()