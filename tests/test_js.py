#!/usr/bin/env python

import unittest
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from functional.belay_test_utils import *
import sys

class TestJavascript(BelayTest):

    def get_result(self):
        resultdiv = self.driver.find_element_by_class_name("runner")
        classStr = resultdiv.get_attribute("class")
        classList = set(classStr.split())
        if "passed" in classList:
            return True
        
        if "failed" in classList:
            return False
        
        return None

    def test_spec_runner(self):
        self.driver.get("file:" + sys.path[0] + "/SpecRunner.html")
        self.wait_for(lambda drv: self.get_result() != None)
        self.assertTrue(self.get_result(), "SpecRunner tests failed")
    
    def test_app_spec_runner(self):
        self.driver.get("file:" + sys.path[0] + "/AppSpecRunner.html")
        self.wait_for(lambda drv: self.get_result() != None, 40)
        self.assertTrue(self.get_result(), "AppSpecRunner tests failed")

if __name__ == "__main__":
    unittest.main()
