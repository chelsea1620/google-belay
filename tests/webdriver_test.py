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

#!/usr/bin/env python -i
# vim: set fileencoding=utf8

# Selenium2/ChromeDriver testing script for Belay. Requires:
#
# - Selenium 2:
#     http://seleniumhq.org/docs/03_webdriver.html
# - WebDriver for Chrome: 
#     http://www.chromium.org/developers/testing/webdriver-for-chrome

from time import sleep
from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver import ActionChains
from selenium.webdriver.remote.webelement import WebElement
import sys

# Needed by Belay
webdriver.DesiredCapabilities.CHROME['chrome.switches'] = \
  [ '--disable-popup-blocking' ]

FUNNY1 = "milk\ncookies\nx.509 certs"
# Insert more jokes here
BELAY_HOST = "http://localhost:9000"
STATION_HOST = "http://localhost:9001"
HELLO_HOST = "http://localhost:9002"
STICKES_HOST = "http://localhost:9003"

driver = webdriver.Chrome()
driver.implicitly_wait(1000)
initial_window = driver.current_window_handle

def launch_station():
  driver.switch_to_window(initial_window)
  driver.get(BELAY_HOST + "/pick-station.html")
  sleep(1)
  driver.find_element_by_id("launch").click()
  sleep(1)
  switch_to_window_by_title("Belay Station")


def switch_to_window_by_title(title):
  for handle in driver.window_handles:
    driver.switch_to_window(handle)
    if driver.title == title:
      sleep(1)
      return
  raise AssertionError("no window with title %s" % title)


def launchButton(name):
  xp = "//div[@class='belay-tool']/img[contains(@src,'%s')]/.." % name
  return driver.find_element_by_xpath(xp)




launch_station()

ActionChains(driver)\
  .move_to_element(launchButton("tool-hello.png"))\
  .click()\
  .click()\
  .move_to_element(launchButton("tool-stickies.png"))\
  .click()\
  .move_to_element(launchButton("tool-buzzer.png")) \
  .click() \
  .move_to_element(launchButton("tool-emote.png")) \
  .click() \
  .perform()


# TODO: doesn't work right
def tile_windows():
  actions = ActionChains(driver)
  titlebars = \
    driver.find_elements_by_xpath("//div[@class='belay-container-header']")
  min_x = min([bar.location['x'] for bar in titlebars])
  min_y = min([bar.location['y'] for bar in titlebars])
  for bar in titlebars:
    pos = bar.location
    size = bar.size
    del_x = min_x - pos['x']
    del_y = 0 # min_y - pos['y']
    min_x = min_x + size['width']
    # min_y = min_y + size['height']
    if del_x == 0 and del_y == 0:
      continue
    print "Moving by (%s, %s)" % (del_x, del_y)
    actions \
      .move_to_element(bar) \
      .click_and_hold(bar) \
      .move_by_offset(del_x, del_y) \
      .release(bar)
  actions.perform()

sleep(1)
tile_windows()


stickyText = \
  driver.find_element_by_xpath("//div[@class='sticky-thing']//textarea")
setLangBtns = \
  driver.find_elements_by_xpath("//div[@class='hello-thing']//a[@href='#']")
ActionChains(driver) \
  .move_to_element(stickyText) \
  .click() \
  .send_keys_to_element(stickyText, FUNNY1) \
  .move_to_element(setLangBtns[0]) \
  .click(setLangBtns[0]) \
  .click() \
  .move_to_element(setLangBtns[1]) \
  .click() \
  .perform()

# Each click refreshes bzr, so we need to find it again, and again, ...
def initBuzzer(bzrXPath, name, loc, msgs):
  ActionChains(driver) \
    .send_keys_to_element(driver
       .find_element_by_xpath(bzrXPath + "//input[@name='name']"), name) \
    .send_keys_to_element(driver
       .find_element_by_xpath(bzrXPath + "//input[@name='location']"), loc) \
    .move_to_element(driver
       .find_element_by_xpath("//input[@type='submit']")) \
    .click() \
    .perform()
  
  for msg in msgs:
    sleep(1)
    ActionChains(driver) \
      .send_keys_to_element(
         driver.find_element_by_xpath(bzrXPath + "//textarea"), msg) \
      .move_to_element(driver.find_element_by_xpath(
                         bzrXPath + "//input[@type='submit']"))\
      .click()\
      .perform()

sleep(1)
initBuzzer("//div[@class='buzzer-thing']",
           "George", "Jungle", [ "swinging", "\b\b\b\b\bin the jungle" ])

print """Please drag the posting cap. on Buzzer onto Emote; press ENTER when 
done."""
sys.stdin.readline()

emotes = driver.find_elements_by_xpath(
  "//div[@class='emote-thing']//a[@class='emote-post']")
ch = ActionChains(driver)
for emote in emotes:
  ch.move_to_element(emote)
  ch.click()
ch.perform()

sleep(1)
buzz_elts = driver.find_elements_by_xpath(
  "//div[@class='buzzer-thing']//p[@class='buzzer-body']")
buzzes = [ elt.text for elt in buzz_elts ]

sleep(1)
driver.close()
launch_station()


stickyText = \
  driver.find_element_by_xpath("//div[@class='sticky-thing']//textarea")
assert stickyText.get_attribute('value') == FUNNY1

def verify_buzzes(buzzes):
  buzz_elts = driver.find_elements_by_xpath(
    "//div[@class='buzzer-thing']//p[@class='buzzer-body']")
  assert buzzes == [ elt.text for elt in buzz_elts ]

verify_buzzes(buzzes)

buzzerCloseBtn = \
  driver.find_element_by_xpath("""//div[@class='sticky-thing']
/ancestor::div[contains(@class, 'belay-container')]
/div[@class='belay-container-header']
/div[text()='×']""")
buzzerOpenPageBtn = driver.find_element_by_xpath("//div[@id='belay-items']//td[contains(text(), 'Buzzer')]/..//span[@class='open-page']")

buzzerCloseBtn.click()
sleep(1)
buzzerOpenPageBtn.click()
sleep(1)

switch_to_window_by_title("Buzzer")
verify_buzzes(buzzes) 

switch_to_window_by_title("Belay Station")
buzzerOpenGadgetBtn = driver.find_element_by_xpath("//div[@id='belay-items']//td[contains(text(), 'Buzzer')]/..//span[@class='open-gadget']")
buzzerOpenGadgetBtn.click()
sleep(1)
verify_buzzes(buzzes)
