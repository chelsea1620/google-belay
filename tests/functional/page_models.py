from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait

class BelayEnabledPage(object):
    """ Common utilities for belay enabled pages. """

    def __init__(self, driver):
        self.driver = driver
        self.window = driver.current_window_handle
        self.wait_for_ready()

    def wait_for(self, p):
        WebDriverWait(self.driver, 5).until(p)

    def page_ready(self, driver=None):
        driver = self.driver if driver == None else driver
        return driver.execute_script("return window.belaytest && window.belaytest.ready")
    
    def wait_for_ready(self):
        self.wait_for(lambda drv: self.page_ready(drv))
    
    def focus(self):
        self.driver.switch_to_window(self.window)
        self.driver.execute_script("window.focus()")
    
    def is_open(self):
        found = false
        for window in self.driver.window_handles:
            found = found and (window == self.window)
        return found

class BelayAdminPage(BelayEnabledPage):
    """ Representation of the contents of the belay-belay admin page. """

    def __init__(self, driver):
        super(BelayAdminPage,self).__init__(driver)

    def get_open_link(self):
        xpath = "//div[@id='open-button']//a"
        return self.driver.find_element_by_xpath(xpath)
    
    def get_create_open_link(self):
        xpath = "//div[@id='create-button']//a"
        return self.driver.find_element_by_xpath(xpath)

    def click_advanced_header(self):
        xpath = "//div[@id='advanced']/h2"
        self.driver.find_element_by_xpath(xpath).click()

    def get_advanced_content(self):
        xpath = "//div[@id='advanced']/div[@class='content']"
        return self.driver.find_element_by_xpath(xpath)
    
    def open_advanced_content(self):
        if not self.get_advanced_content().is_displayed():
            self.click_advanced_header()
            self.wait_for(lambda x: self.get_advanced_content().is_displayed())

    def close_advanced_content(self):
        if self.get_advanced_content().is_displayed():
            self.click_advanced_header()
            self.wait_for(lambda x: not self.get_advanced_content().is_displayed())

    def get_station_cap_field(self):
        return self.driver.find_element_by_id("station-cap")
    
    def get_station_cap_set_button(self):
        return self.driver.find_element_by_id("station-set")

    def get_station_cap_clear_button(self):
        return self.driver.find_element_by_id("station-clear")

    def get_current_station(self):
        return self.get_station_cap_field().get_attribute("value")

    def clear_station(self):
        self.get_station_cap_clear_button().click()
        self.wait_for(lambda x: self.get_current_station() == "")
    
    def generate_station_using_index(self, index):
        self.open_advanced_content()
        xpath = "//div[@class='gen'][" + str(index) + "]/button"
        self.driver.find_element_by_xpath(xpath).click()
    
    def get_custom_station_gen_field(self):
        xpath = "//div[@class='gen'][3]/input"
        return self.driver.find_element_by_xpath(xpath)

    def generate_new_public_station(self):
        self.generate_station_using_index(1)
        
    def generate_new_local_station(self):
        self.generate_station_using_index(2)

    def generate_new_custom_station(self, gen_url):
        field = self.get_custom_station_gen_field()
        field.clear()
        field.send_keys(gen_url)
        self.generate_station_using_index(3)

    def open_station(self):
        if self.get_current_station() == "":
            self.generate_new_local_station()
        
        current_windows = list(self.driver.window_handles)
        self.wait_for(lambda x: self.get_open_link().is_displayed())
        self.get_open_link().click()

        def new_page_opened(driver):
            return (len(driver.window_handles) > len(current_windows))

        self.wait_for(new_page_opened)
        other_windows = list(self.driver.window_handles)
        for window in current_windows:
            other_windows.remove(window)
        station_window = other_windows[0]
        self.driver.switch_to_window(station_window)
        return BelayStationPage(self.driver)

class BelayStationInstance(object):

    def __init__(self, section, instance_row):
        self.section = section
        self.row = instance_row

    def name(self):
        return self.row.find_element_by_xpath("td[@class='name']").text

class BelayStationSection(object):

    def __init__(self, station, section_elem):
        self.station = station
        self.elem = section_elem

    def name(self):
        return self.elem.find_element_by_xpath("table[@class='header']//td[@class='name']").text

    def is_empty(self):
        """ determines whether any instances exist in the section. """
        return len(self.instances()) == 0

    def instances(self):
        rows = self.elem.find_elements_by_xpath("table[@class='items']//tr")
        return [BelayStationInstance(self, row) for row in rows]

class BelayStationPage(BelayEnabledPage):
    """ Representation of the contents of the belay-station page. """

    def __init__(self, driver):
        super(BelayStationPage,self).__init__(driver)

    def categories(self):
        belay_items = self.driver.find_element_by_id("belay-items")
        category_elems = belay_items.find_elements_by_class_name("section")
        categories = list()
        for elem in category_elems:
            categories.append(BelayStationSection(self, elem))
        
        return categories

    def uncategorized(self):
        return self.categories()[0]

    def is_empty(self):
        """ determines whether any instances exist in the station. """
        empty = True
        for category in self.categories():
            empty = empty and category.is_empty()
        return empty

class BuzzerLandingPage(BelayEnabledPage):
    def __init__(self, driver):
        super(BuzzerLandingPage,self).__init__(driver)

    def create_new_instance(self, title):
        self.get_title_field().send_keys(title)
        self.driver.find_element_by_xpath("//form//input[@type='submit']").submit()
        def check_url(driver):
            return driver.current_url == "http://localhost:9004/buzzer-belay.html"

        self.wait_for(check_url)
        return BuzzerInstancePage(self.driver)

    def get_title_field(self):
        return self.driver.find_element_by_xpath("//form//input[@type='text']")

    def get_form(self):
        return self.driver.find_element_by_xpath("//form")


class BuzzerInstancePage(BelayEnabledPage):
    def __init__(self, driver):
        super(BuzzerInstancePage,self).__init__(driver)
        self.name = self.driver.find_element_by_id("buzzer-name").text


def open_belay_admin(driver):
    driver.get("http://localhost:9000")
    return BelayAdminPage(driver)
