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
        self.st.move_to_category(buzzer_entry, self.st.personal())
        
        js_errors = self.st.get_js_errors()
        self.assertEqual(0, len(js_errors), "Found JS Errors: " + str(js_errors))

        buzzer_entry = self.st.find_instances_by_name("Buzz 1")[0]
        buzzer_entry.open(self.driver)
        bzr = BuzzerInstancePage(self.driver)
        self.assertTrue("Betsy Claypool", bzr.get_poster_name_attribute())
        self.assertTrue("Pennsylvania", bzr.get_poster_location_attribute())
    
    def test_suggestions_offered(self):
        """
        Ensures that suggestions will be offered when known instances exist
        for a particular site.
        """
        self.open_new_window("http://localhost:9004")
        landing = BuzzerLandingPage(self.driver)
        bzr = landing.create_new_instance("Buzz")
        bzr.close()

        self.st.focus()
        self.open_new_window("http://localhost:9004")
        landing = BuzzerLandingPage(self.driver)
        
        self.assertEquals(1, len(landing.get_suggestions()))
        self.assertEquals("Buzz", landing.get_suggestions()[0])

        landing.open_suggestion("Buzz")
        bzr = BuzzerInstancePage(self.driver)
        self.assertEquals("Buzz", bzr.get_name())


    def test_suggestions_not_offered_for_trash(self):
        """
        Ensures that when an instance is moved to the trash, that it will not
        be offered as a suggestion when the user opens the site.
        """

        self.open_new_window("http://localhost:9004")
        landing = BuzzerLandingPage(self.driver)
        landing = landing.create_new_instance("Buzz")
        landing.close()

        self.st.focus()
        trash = self.st.trash()
        instance = self.st.find_instances_by_name("Buzz")[0]
        self.st.move_to_category(instance, trash)

        self.open_new_window("http://localhost:9004")
        landing = BuzzerLandingPage(self.driver)
        self.assertEquals(0, len(landing.get_suggestions()))






if __name__ == "__main__":
    unittest.main()
