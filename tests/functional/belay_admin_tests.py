# Copyright 2011 Google Inc. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

#!/usr/bin/env python

import unittest
from page_models import *
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from belay_test_utils import *

class BelayAdminTests(BelayTest):

    def setUp(self):
        super(BelayAdminTests,self).setUp()
        self.ba = open_belay_admin(self.driver)

    def test_initial_state(self):
        ba = self.ba
        self.assertEqual("Belay Belay - Administration", self.driver.title)
        self.assertTrue(ba.get_create_open_link().is_displayed())
        self.assertFalse(ba.get_open_link().is_displayed())
        self.assertFalse(ba.get_advanced_content().is_displayed())
        self.assertEqual("", ba.get_station_cap_field().get_attribute("value"))
        self.assertFalse(ba.get_station_cap_set_button().is_enabled())
        self.assertFalse(ba.get_station_cap_set_button().is_enabled())

    def test_open_close_advanced(self):
        ba = self.ba
        self.assertFalse(ba.get_advanced_content().is_displayed())
        ba.open_advanced_content()
        self.assertTrue(ba.get_advanced_content().is_displayed())
        ba.close_advanced_content()
        self.assertFalse(ba.get_advanced_content().is_displayed())
    
    def test_generate_stations(self):
        ba = self.ba
        ba.open_advanced_content()

        def check_generate(url_prefix):
            self.wait_for(lambda x: ba.get_station_cap_field().get_attribute("value").startswith(url_prefix))
            self.assertTrue(ba.get_open_link().is_displayed())
            self.assertTrue(ba.get_station_cap_clear_button().is_enabled())
            self.assertFalse(ba.get_station_cap_set_button().is_enabled())

        ba.generate_new_public_station()
        check_generate("https://belay-station.appspot.com/belay/launch?s=")
        ba.clear_station()

        ba.generate_new_local_station()
        check_generate("http://localhost:9001/belay/launch?s=")
        ba.clear_station()

        # test custom generate by supplying the generate for the
        # normal localhost station
        ba.generate_new_custom_station("http://localhost:9001/belay/generate")
        check_generate("http://localhost:9001/belay/launch?s=")
    
    def test_create_and_launch(self):
        ba = self.ba
        st = ba.open_station()
        self.assertTrue(st.is_empty())


if __name__ == "__main__":
    unittest.main()
