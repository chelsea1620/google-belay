#!/usr/bin/env python

import unittest
from page_models import *
from emote_model import *
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from belay_test_utils import *
from selenium.webdriver.common.action_chains import *
import time

class EmoteTests(BelayTest):

    def setUp(self):
        super(EmoteTests,self).setUp()
        self.ba = open_belay_admin(self.driver)
        self.st = self.ba.open_station()
        self.open_new_window("http://localhost:9004")
        bzr_start = BuzzerLandingPage(self.driver)
        self.bzr = bzr_start.create_new_instance("Testing")
        self.st.focus()
        self.open_new_window("http://localhost:9005")
        self.em = EmotePage(self.driver)

    def bind(self):
        self.assertFalse(self.em.is_instance())
        self.bzr.focus()
        post_cap = self.bzr.get_post_cap()
        self.em.focus()
        self.em.attach_to_buzzer(post_cap)

    def test_bind_to_buzzer(self):
        self.bind()
        self.st.focus()
        self.assertTrue(len(self.st.uncategorized().instances()) == 2)
        instances = self.st.find_instances_by_name("Emote to Testing")
        self.assertTrue(len(instances) == 1)

    def test_post_while_buzzer_open(self):
        self.bind()
        self.assertTrue(self.em.post(':-)'))
        self.bzr.focus()
        self.wait_for(lambda x: self.bzr.get_posts()
            and self.bzr.get_last_post().get_content() == ':-)')

    def test_post_while_buzzer_closed(self):
        self.bind()
        self.bzr.focus()
        self.bzr.close()
        self.em.focus()
        self.assertFalse(self.em.post(':-)'))
        self.st.focus()
        self.st.find_instances_by_name("Testing")[0].open(self.driver)
        self.bzr = BuzzerInstancePage(self.driver)
        self.assertTrue(len(self.bzr.get_posts()) == 0)


if __name__ == "__main__":
    unittest.main()