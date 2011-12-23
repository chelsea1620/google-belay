from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.common.action_chains import *
from belay_test_utils import *
from time import *
import random
import os

class BelayEnabledPage(object):
    """ Common utilities for belay enabled pages. """

    def __init__(self, driver):
        self.driver = driver
        self.window = driver.current_window_handle
        self.wait_for_ready()
        self.inject_js_error_detect()
        self.disable_jquery_animations()
    
    def inject_js_error_detect(self):
        self.driver.execute_script("""
            window.belaytest.jsErrors = [];
            window.addEventListener('error', function(evt) {
                window.belaytest.jsErrors.push({
                    msg: evt.message,
                    file: evt.filename,
                    lineNum: evt.lineno,
                });
            });
        """)
    
    def disable_jquery_animations(self):
        self.driver.execute_script('jQuery.fx.off = true;')
    
    def get_js_errors(self):
        exec_js = self.driver.execute_script
        num_errors = exec_js("return window.belaytest.jsErrors.length")
        print "Errors: %d" % num_errors
        errors = []
        for i in range(0,num_errors):
            errors.append(exec_js("return window.belaytest.jsErrors[%d]" % i))

        return errors

    def drag_from(self, source_jq_matcher):
        driver = self.driver
        driver.execute_script("""
            var fakeDragEvt = document.createEvent('UIEvents');
            fakeDragEvt.initEvent('dragstart', true, true);
            fakeDragEvt.dataTransfer = {
                setDragImage: function(x, y, z) {},
                setData: function(mime, data) {
                    belaytest.dropped_data = data;
                }
            };
            $('%s')[0].dispatchEvent(fakeDragEvt);
        """ % source_jq_matcher)
        data = driver.execute_script("return belaytest.dropped_data")
        driver.execute_script("delete belaytest.dropped_data")
        return data
    

    def drag_to(self, cap_data, target_jq_matcher):
        temp_source_id = "belaytest_ddsource_" + str(random.randint(0, 2 ** 64))
        self.driver.execute_script("""
            var fakeDropEvt = document.createEvent('UIEvents');
            fakeDropEvt.initEvent('drop', true, true);
            fakeDropEvt.dataTransfer = {
                getData: function(mime) {
                    return '%s';
                }
            };
            $('%s')[0].dispatchEvent(fakeDropEvt);
        """ % (cap_data, target_jq_matcher))
    
    def page_ready(self, driver=None):
        driver = self.driver if driver == None else driver
        driver.switch_to_default_content()
        return driver.execute_script("return window.belaytest && window.belaytest.ready")
    
    def condemn(self):
        self.driver.execute_script("delete window.belaytest")
        
    def wait_for(self, p, timeout=5):
        wait_for(self.driver, p, timeout)

    def wait_for_ready(self):
        self.wait_for(self.page_ready)
    
    def wait_for_suggestions(self):
        self.wait_for(self.are_suggestions_visible)
    
    def focus(self):
        self.driver.switch_to_window(self.window)
        self.driver.execute_script("window.focus()")
    
    def close(self):
        self.driver.switch_to_window(self.window)
        self.driver.close()
        sleep(2)
    
    def is_open(self):
        found = False
        for window in self.driver.window_handles:
            found = found and (window == self.window)
        return found

    def are_suggestions_visible(self, driver=None):
        driver = self.driver if driver == None else driver
        driver.switch_to_frame("belay-frame")
        try:
          suggest_bar = driver.find_element_by_id('suggestButtons')
          return suggest_bar.is_displayed()
        finally:
          driver.switch_to_default_content()
        
    def get_suggestions(self):
        self.driver.switch_to_default_content()
        self.driver.switch_to_frame("belay-frame")
        suggest_button_xpath = "//button[@class='suggestButton']"
        buttons = self.driver.find_elements_by_xpath(suggest_button_xpath)
        suggestions = [button.text for button in buttons]
        self.driver.switch_to_default_content()
        return suggestions

    def open_suggestion(self, suggestion):
        self.condemn()
        self.driver.switch_to_frame("belay-frame")
        suggest_button_xpath = "//button[@class='suggestButton']"
        buttons = self.driver.find_elements_by_xpath(suggest_button_xpath)

        for b in buttons:
            if b.text == suggestion:
                # this is horrible, but I can't find any way to figure out when an
                # item is both displayed and clickable when a CSS animation is
                # currently being applied. So, we must wait for the butter bar
                # CSS animation to complete before we can go ahead and click
                sleep(1)
                b.click()
                return


class BelayAdminPage(BelayEnabledPage):
    """ Representation of the contents of the belay-belay admin page. """

    def __init__(self, driver):
        super(BelayAdminPage,self).__init__(driver)

    def get_open_link(self):
        xpath = "//div[@id='open-button']//a"
        return self.driver.find_element_by_xpath(xpath)
    
    def get_create_open_link(self):
        xpath = "//div[@id='create-button']//a"
        return self.driver.find_element_by_xpath(xpath)

    def click_advanced_header(self):
        xpath = "//div[@id='advanced']/h2"
        self.driver.find_element_by_xpath(xpath).click()

    def get_advanced_content(self):
        xpath = "//div[@id='advanced']/div[@class='content']"
        return self.driver.find_element_by_xpath(xpath)
    
    def open_advanced_content(self):
        if not self.get_advanced_content().is_displayed():
            self.click_advanced_header()
            self.wait_for(lambda x: self.get_advanced_content().is_displayed())

    def close_advanced_content(self):
        if self.get_advanced_content().is_displayed():
            self.click_advanced_header()
            self.wait_for(lambda x: not self.get_advanced_content().is_displayed())

    def get_station_cap_field(self):
        return self.driver.find_element_by_id("station-cap")
    
    def get_station_cap_set_button(self):
        return self.driver.find_element_by_id("station-set")

    def get_station_cap_clear_button(self):
        return self.driver.find_element_by_id("station-clear")

    def get_current_station(self):
        return self.get_station_cap_field().get_attribute("value")

    def clear_station(self):
        self.get_station_cap_clear_button().click()
        self.wait_for(lambda x: self.get_current_station() == "")
    
    def generate_station_using_index(self, index):
        self.open_advanced_content()
        xpath = "//div[@class='gen'][" + str(index) + "]/button"
        self.driver.find_element_by_xpath(xpath).click()
    
    def get_custom_station_gen_field(self):
        xpath = "//div[@class='gen'][3]/input"
        return self.driver.find_element_by_xpath(xpath)

    def generate_new_public_station(self):
        self.generate_station_using_index(1)
        
    def generate_new_local_station(self):
        self.generate_station_using_index(2)

    def generate_new_custom_station(self, gen_url):
        field = self.get_custom_station_gen_field()
        field.clear()
        field.send_keys(gen_url)
        self.generate_station_using_index(3)

    def open_station(self):
        if self.get_current_station() == "":
            self.generate_new_local_station()
        
        def open_action():
            self.wait_for(lambda x: self.get_open_link().is_displayed())
            self.get_open_link().click()

        find_new_window(self.driver, open_action)
        return BelayStationPage(self.driver)

class BelayStationInstance(object):

    def __init__(self, section, instance_row):
        self.section = section
        self.row = instance_row

    def name(self):
        return self.row.find_element_by_xpath("td[@class='name']").text

    def open(self, driver):
        find_new_window(driver, lambda: self.row.find_element_by_tag_name("a").click())
    
    def delete(self):
        self.row.find_element_by_xpath("//span[@class='remove']").click()
        # wait for delete animation to complete
        sleep(1)
    
    def get_drag_source(self):
        return self.row

    def get_drag_source_jq_matcher(self):
        elements = self.section.elem.find_elements_by_xpath('table[@class="items"]//tr')
        print len(elements)
        index = 0
        my_name = self.name()
        for element in elements:
            if element.find_element_by_xpath("td[@class='name']").text == my_name:
                break
            index += 1

        return '.items tr:eq(%d)' % index
    
    def is_displayed(self):
        return self.row.is_displayed()


class BelayStationSection(object):

    def __init__(self, station, section_elem):
        self.station = station
        self.elem = section_elem

    def name(self):
        return self.elem.find_element_by_xpath("table[@class='header']//td[@class='name']").text

    def is_empty(self):
        """ determines whether any instances exist in the section. """
        return len(self.instances()) == 0

    def instances(self):
        rows = self.elem.find_elements_by_xpath("table[@class='items']//tr")
        return [BelayStationInstance(self, row) for row in rows]
    
    def get_drop_target(self):
        return self.elem

    def get_drop_target_jq_matcher(self):
        return "#section-" + self.name()

    def set_attributes(self, attrs):
        driver = self.station.driver
        self.open_attributes()

        attributes_to_set = list(attrs)
        
        attribute_rows = self.elem.find_elements_by_xpath("table//table//tr")
        for row in attribute_rows:
            attr_name = row.find_element_by_class_name("tag").text
            if attr_name in attrs:
                indicator = row.find_element_by_class_name("indicator")
                wait_for(driver, lambda drv: indicator.is_displayed);
                indicator.click()
                select_group = row.find_element_by_tag_name("ul")
                wait_for(driver, lambda drv: select_group.is_displayed())
                
                found = False
                selections = select_group.find_elements_by_tag_name("span")
                for selection in selections:
                    if selection.text == attrs[attr_name]:
                        found = True
                        selection.click()

                if not found:
                    raise Exception("Attribute value %s not a valid option" 
                        % attrs[attr_name])
                
                attributes_to_set.remove(attr_name)
        
        if attributes_to_set:
            raise Exception ("Could not set: %s" % attributes_to_set)
        
        self.save_attributes()
    
    def open_attributes(self):
        driver = self.station.driver
        cls_finder = self.elem.find_element_by_class_name

        if cls_finder("attributes").is_displayed():
            return
        
        settings_link = cls_finder("settings")
        settings_link.click()
        wait_for(driver, lambda drv: cls_finder("attributes").is_displayed())

    def save_attributes(self):
        self.elem.find_element_by_class_name("save").click()
        attributes = self.elem.find_element_by_class_name("attributes")
        wait_for(self.station.driver, lambda drv: not attributes.is_displayed())
    
    def cancel_attributes(self):
        self.elem.find_element_by_class_name("cancel").click()
        attributes = self.elem.find_element_by_class_name("attributes")
        wait_for(self.station.driver, lambda drv: not attributes.is_displayed())


class BelayStationPage(BelayEnabledPage):
    """ Representation of the contents of the belay-station page. """

    def __init__(self, driver):
        super(BelayStationPage,self).__init__(driver)

    def categories(self):
        belay_items = self.driver.find_element_by_id("belay-items")
        category_elems = belay_items.find_elements_by_class_name("section")
        categories = list()
        for elem in category_elems:
            categories.append(BelayStationSection(self, elem))
        
        return categories

    def category_for_name(self, name):
        for category in self.categories():
            if category.name() == name:
                return category

        return None

    def uncategorized(self):
        return self.categories()[0]
    
    def personal(self):
        return self.categories()[1]

    def is_empty(self):
        """ determines whether any instances exist in the station. """
        empty = True
        for category in self.categories():
            empty = empty and category.is_empty()
        return empty
    
    def find_instances_by_name(self, name):
        cats = self.categories()
        instances = list()
        for cat in cats:
            for inst in cat.instances():
                if inst.name() == name:
                    instances.append(inst)

        return instances

    def move_to_category(self, instance, category):
        drag_source = instance.get_drag_source_jq_matcher()
        drop_target = category.get_drop_target_jq_matcher()
        data = self.drag_from(drag_source)
        
        old_instance_count = category.instances()
        self.drag_to(data, drop_target)
        
        self.wait_for(lambda drv: category.instances() > old_instance_count)
    
    def add_profile(self, name, email, location):
        self.driver.find_element_by_id("id-add-button").click()

        id_add_dialog = self.driver.find_element_by_id("id-add-dialog")
        id_add_dialog.find_element_by_name("name").click()
        id_add_dialog.find_element_by_name("name").send_keys(name)
        id_add_dialog.find_element_by_name("location").click()
        id_add_dialog.find_element_by_name("location").send_keys(location)
        id_add_dialog.find_element_by_name("email").click()
        id_add_dialog.find_element_by_name("email").send_keys(email)

        id_add_dialog.find_element_by_class_name("widget-keyhole-button").click()
        overlay = self.driver.find_element_by_class_name('dark-screen')
        self.wait_for(lambda drv: not overlay.is_displayed())


class BuzzerLandingPage(BelayEnabledPage):
    def __init__(self, driver):
        super(BuzzerLandingPage,self).__init__(driver)

    def create_new_instance(self, title):
        self.condemn()
        self.get_title_field().send_keys(title)
        self.driver.find_element_by_xpath("//form//input[@type='submit']").submit()
        return BuzzerInstancePage(self.driver)

    def get_title_field(self):
        return self.driver.find_element_by_xpath("//form//input[@type='text']")

    def get_form(self):
        return self.driver.find_element_by_xpath("//form")

class BuzzerPost(object):
    def __init__(self, instance, post_div):
        self.instance = instance
        self.post_div = post_div

    def get_content(self):
        content_div = self.post_div.find_element_by_class_name("buzzer-body")
        return content_div.text

class BuzzerInstancePage(BelayEnabledPage):
    def __init__(self, driver):
        super(BuzzerInstancePage,self).__init__(driver)

    def post(self, postText):
        num_posts = len(self.get_posts())
        self.get_post_field().clear()
        self.get_post_field().send_keys(postText)
        self.get_post_button().click()
        self.wait_for(lambda drv: len(self.get_posts()) > num_posts)

    def get_name(self):
        return self.driver.find_element_by_id("buzzer-name").text

    def get_post_field(self):
        return self.driver.find_element_by_id("body")

    def get_post_button(self):
        return self.driver.find_element_by_tag_name("input")

    def get_posts(self):
        item_xpath = "//div[@class='buzzer-item']"
        items = self.driver.find_elements_by_xpath(item_xpath)
        return [ BuzzerPost(self, item) for item in items ]

    def get_last_post(self):
        return self.get_posts()[0]
    
    def get_read_only_cap(self):
        return self.drag_from('.buzzer-reader-chit')

    def get_post_cap(self):
        return self.drag_from('.buzzer-post-chit')

    def get_read_only_chit(self):
        return self.driver.find_element_by_class_name("buzzer-reader-chit")
    
    def get_poster_name_attribute(self):
        xpath_find = self.driver.find_elements_by_xpath
        name = xpath_find("//i[@class='poster-name']")
        if name:
            return name[0].text
        
        return None
    
    def get_poster_location_attribute(self):
        xpath_find = self.driver.find_elements_by_xpath
        location = xpath_find("//i[@class='poster-location']")
        if location:
            return location[0].text
        
        return None
    
    def is_read_only(self):
        # we can determine if this is a read-only view by the absence
        # of the input text area
        return len(self.driver.find_elements_by_id('body')) == 0


def open_belay_admin(driver):
    driver.get("http://localhost:9000")
    return BelayAdminPage(driver)
