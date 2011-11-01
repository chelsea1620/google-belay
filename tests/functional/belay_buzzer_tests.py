#!/usr/bin/env python

import unittest
from page_models import *
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from belay_test_utils import *
from selenium.webdriver.common.action_chains import *
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
        self.assertEqual("Testing", instance.get_name())
        self.st.focus()
        self.assertFalse(self.st.is_empty())
        self.assertEqual("Testing", self.st.uncategorized().instances()[0].name())
    
    def test_post(self):
        instance = self.bzr.create_new_instance("Testing")
        instance.post("1")
        instance.post("2")
        instance.post("3")

        posts = [post.get_content() for post in instance.get_posts()]
        self.assertEqual(["3", "2", "1"], posts)

    def test_multiple_instances(self):
        a = self.bzr.create_new_instance("A")
        
        # annoyingly, our current window opening method will result in the
        # same session storage object being shared between two windows
        # if they are on the same domain. So here we open the new belay
        # instance while the station is focused, to force a separate
        # session storage.
        self.st.focus()
        self.open_new_window("http://localhost:9004")
        b_start = BuzzerLandingPage(self.driver)
        b = b_start.create_new_instance("B")

        a.focus()
        a.post("i am a")

        b.focus()
        b.post("i am b")

        a.focus()
        self.assertEqual("i am a", a.get_last_post().get_content())
        
        b.focus()
        self.assertEqual("i am b", b.get_last_post().get_content())

        self.st.focus()
        self.assertTrue(len(self.st.find_instances_by_name("A")) == 1)
        self.assertTrue(len(self.st.find_instances_by_name("B")) == 1)
    
    def test_attribute_exchange(self):
        st = self.st
        instance = self.bzr.create_new_instance("My Blog")
        st.focus()

        st.personal().set_attributes({
            "Name": "Betsy Claypool",
            "Location": "Pennsylvania"
        })

        drag_source = self.st.uncategorized().instances()[0].get_drag_source()
        drop_target = self.st.personal().get_drop_target()
        ac = ActionChains(self.driver)
        ac.drag_and_drop(drag_source, drop_target)
        ac.perform()
        self.wait_for(lambda drv: self.st.personal().instances() > 0)

        moved = self.st.personal().instances()[0]
        self.assertTrue("My Blog", moved.name())

        instance.focus()
        instance.get_poster_name_attribute()
        instance.get_poster_location_attribute()


    def test_relaunch_from_station(self):
        instance = self.bzr.create_new_instance("Testing")
        instance.post("test post")
        instance.close()
        self.st.focus()

        # the station does not realise a page has closed for at least a few
        # seconds with the current implementation, so we must wait before
        # we attempt to reopen the site
        time.sleep(4)
        self.st.find_instances_by_name("Testing")[0].open(self.driver)
        reopenedInstance = BuzzerInstancePage(self.driver)
        self.assertEquals("Testing", reopenedInstance.get_name())
        self.assertEquals("test post", reopenedInstance.get_last_post().get_content())

    def test_relaunch(self):
        instance = self.bzr.create_new_instance("Testing")
        instance.post("hello world")

        self.driver.refresh()
        instance.wait_for_ready()

        self.assertEquals("Testing", instance.get_name())
        self.assertEquals("hello world", instance.get_last_post().get_content())

    



if __name__ == "__main__":
    unittest.main()
