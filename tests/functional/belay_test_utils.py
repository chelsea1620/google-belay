#!/usr/bin/env python2.7

import unittest
from page_models import *
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait

class BelayTest(unittest.TestCase):

    def setUp(self):
        self.driver = webdriver.Chrome()

    def tearDown(self):
        self.driver.quit()

    def wait_for(self, p, timeout=5):
        WebDriverWait(self.driver, timeout).until(p)
    
    def open_new_window(self, url):
        current_windows = list(self.driver.window_handles)
        
        self.driver.execute_script("window.open('" + url + "')");

        def new_page_opened(driver):
            return (len(driver.window_handles) > len(current_windows))

        self.wait_for(new_page_opened)
        other_windows = list(self.driver.window_handles)
        for window in current_windows:
            other_windows.remove(window)
        new_window = other_windows[0]
        self.driver.switch_to_window(new_window)
