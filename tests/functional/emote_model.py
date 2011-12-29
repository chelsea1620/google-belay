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

from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.common.action_chains import *
from belay_test_utils import *
from page_models import *

class EmotePage(BelayEnabledPage):

    def is_instance(self):
        invite_box = self.driver.find_element_by_id("emote-invite")
        return not invite_box.is_displayed()

    def attach_to_buzzer(self, post_cap):
        self.condemn()
        self.drag_to(post_cap, '#emote-invite')
        self.wait_for_ready()

    def post(self, smiley):
        buttons = self.driver.find_elements_by_class_name('emote-post')
        for button in buttons:
            if button.text == smiley:
                button.click()

        id_finder = self.driver.find_element_by_id
        success_indicator = id_finder('emote-message-posted')
        fail_indicator = id_finder('emote-message-failed')
        self.wait_for(lambda drv: (success_indicator.is_displayed() or
            fail_indicator.is_displayed()), 10)

        return success_indicator.is_displayed()