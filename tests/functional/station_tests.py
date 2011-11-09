#!/usr/bin/env python

import unittest
from page_models import *
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from belay_test_utils import *
import time


class StationTests(BelayTest):

    def setUp(self):
        super(StationTests,self).setUp()
        self.ba = open_belay_admin(self.driver)
        self.st = self.ba.open_station()
    
    def test_move_section_on_fresh_open(self):
        """
        Ensures that moving instances and attribute exchange works immediately 
        after opening the station.
        """

        self.open_new_window("http://localhost:9004")
        landing = BuzzerLandingPage(self.driver)
        bzr = landing.create_new_instance("Buzz 1")
        bzr.close()
        
        self.st.focus()
        self.st.close()
        self.ba.focus()
        self.st = self.ba.open_station()

        self.st.personal().set_attributes({
            "Name": "Betsy Claypool",
            "Location": "Pennsylvania"
        })

        buzzer_entry = self.st.find_instances_by_name("Buzz 1")[0]
        drag_source = buzzer_entry.get_drag_source()
        drop_target = self.st.personal().get_drop_target()
        ac = ActionChains(self.driver)
        ac.drag_and_drop(drag_source, drop_target)
        ac.perform()
        self.wait_for(lambda drv: self.st.personal().instances() > 0)

        js_errors = self.st.get_js_errors()
        self.assertEqual(0, len(js_errors), "Found JS Errors: " + str(js_errors))

        buzzer_entry = self.st.find_instances_by_name("Buzz 1")[0]
        buzzer_entry.open(self.driver)
        bzr = BuzzerInstancePage(self.driver)
        self.assertTrue("Betsy Claypool", bzr.get_poster_name_attribute())
        self.assertTrue("Pennsylvania", bzr.get_poster_location_attribute())


if __name__ == "__main__":
    unittest.main()
