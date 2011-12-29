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
