#!/usr/bin/env python

import unittest
from page_models import *
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from belay_test_utils import *
import time

class BelayBuzzerTests(BelayTest):

    def setUp(self):
        super(BelayBuzzerTests,self).setUp()
        self.ba = open_belay_admin(self.driver)
        self.st = self.ba.open_station()
        self.open_new_window("http://localhost:9004")
        self.bzr = BuzzerLandingPage(self.driver)

    def test_generate_instance(self):
        instance = self.bzr.create_new_instance("Testing")
        self.assertEqual("Testing", instance.name)
        self.st.focus()
        self.assertFalse(self.st.is_empty())
        self.assertEqual("Testing", self.st.uncategorized().instances()[0].name())

if __name__ == "__main__":
    unittest.main()
