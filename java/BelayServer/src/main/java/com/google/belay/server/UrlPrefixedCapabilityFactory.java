/* Copyright 2011 Google Inc. All Rights Reserved.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.google.belay.server;

import java.net.MalformedURLException;
import java.net.URL;
import java.util.UUID;

/**
 * A {@link CapabilityFactory} which uses a {@link CapabilityMapBackend} to
 * generate UUID-based capabilities as required, and converts these into an
 * invokeable URL form based on a known URL prefix to the capability servlet.
 * The URL prefix must end with a '/', in order to properly delimit the section
 * of the URL which contains the UUID.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 * 
 */
public class UrlPrefixedCapabilityFactory implements CapabilityFactory {

  private final String urlPrefix;
  private final CapabilityMapBackend backend;

  public UrlPrefixedCapabilityFactory(String urlPrefix,
      CapabilityMapBackend backend) {
    try {
      new URL(urlPrefix);
    } catch (MalformedURLException e) {
      throw new IllegalArgumentException(String.format(
          "url prefix '%s' is not a valid url", urlPrefix));
    }

    if (!urlPrefix.endsWith("/")) {
      throw new IllegalArgumentException(String.format(
          "url prefix '%s' does not end with a '/'", urlPrefix));
    }

    this.urlPrefix = urlPrefix;
    this.backend = backend;
  }

  @Override
  public Capability grant(String service) {
    return createCap(backend.grant(service));
  }

  @Override
  public Capability grant(String service, String boundEntity) {
    return createCap(backend.grant(service, boundEntity));
  }

  @Override
  public Capability regrant(String service) throws AmbiguousRegrantException {
    return createCap(backend.regrant(service));
  }

  @Override
  public Capability regrant(String service, String boundEntity)
      throws AmbiguousRegrantException {
    return createCap(backend.regrant(service));
  }

  @Override
  public void revoke(Capability cap) {
    String capUrlStr = cap.getCapUrl().toExternalForm();
    if (!capUrlStr.startsWith(urlPrefix)) {
      // TODO(iainmcgin): should this be a warning?
      return;
    }

    String capIdStr = capUrlStr.substring(urlPrefix.length());
    UUID capId = UUID.fromString(capIdStr);
    backend.revoke(capId);
  }

  private Capability createCap(UUID capId) {
    try {
      URL capUrl = new URL(urlPrefix + capId.toString());
      return new Capability(capUrl);
    } catch (MalformedURLException e) {
      // if the urlPrefix has been properly vetted, then this should not
      // occur
      return null;
    }
  }
}
