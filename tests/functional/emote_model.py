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
        self.drag_cap_in(post_cap, '#emote-invite')
        self.wait_for(lambda x: self.is_instance())

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