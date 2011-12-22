// Copyright 2011 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

define(function() {

  var pages = {};
  var nextPageId = 0;
  var defaultPageId = null;
  var currentPageId = null;

  function registerPage(navElem, showHandler, hideHandler) {
    var pageId = nextPageId++;
    pages[pageId] = {
      navElem: navElem,
      showHandler: showHandler,
      hideHandler: hideHandler
    }

    navElem.click(function() { showPage(pageId); });

    return pageId;
  }

  function registerDefaultPage(navElem, showHandler, hideHandler) {
    var pageId = registerPage(navElem, showHandler, hideHandler);
    defaultPageId = pageId;
  }

  function showPage(pageId) {
    if(!(pageId in pages)) return;
    hidePage(currentPageId);
    pages[pageId].navElem.addClass('selected');
    pages[pageId].showHandler();
    currentPageId = pageId;
  }

  function showDefaultPage() {
    if(defaultPageId === null) return;
    showPage(defaultPageId);
  }

  function hidePage(pageId) {
    if(!(pageId in pages)) return;

    pages[currentPageId].navElem.removeClass('selected');
    pages[currentPageId].hideHandler();
    currentPageId = null;
  }

  function returnToDefault() {
    if(currentPageId != defaultPageId) {
      hidePage(currentPageId);
    }
    showDefaultPage();
  }

  return {
    registerPage: registerPage,
    registerDefaultPage: registerDefaultPage,
    showPage: showPage,
    showDefaultPage: showDefaultPage,
    returnToDefault: returnToDefault
  }
})