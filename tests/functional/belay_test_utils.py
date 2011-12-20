#!/usr/bin/env python

import os
import unittest
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait

debug = os.environ.get('DEBUG', None);

class BelayTest(unittest.TestCase):

    def setUp(self):
        self.driver = webdriver.Chrome()
        #self.driver = webdriver.Firefox()
        if debug:
          scopeUrl = "http://localhost:9000/scope.html"
          self.driver.execute_script("window.open('" + scopeUrl + "')")

    def tearDown(self):
        if debug:
          raw_input('Press return to exit >>>')
        self.driver.quit()
    
    def wait_for(self, p, timeout=5):
        wait_for(self.driver, p, timeout)
    
    def open_new_window(self, url):
        def open_action():
            self.driver.execute_script("window.open('" + url + "')")
        find_new_window(self.driver, open_action)

def wait_for(driver, p, timeout=5):
    WebDriverWait(driver, timeout).until(p)

def find_new_window(driver, open_fn):
    """ 
    triggers open_fn with the expectation that a new window will be created,
    and will return with this new window focused
    """
    current_windows = list(driver.window_handles)
    open_fn()

    def new_page_opened(driver):
        return (len(driver.window_handles) > len(current_windows))

    wait_for(driver, new_page_opened)
    other_windows = list(driver.window_handles)
    for window in current_windows:
        other_windows.remove(window)
    new_window = other_windows[0]
    driver.switch_to_window(new_window)