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

/**
 * Thrown if an attempt is made to regrant a capability to a path and entity
 * pair that has been granted at least twice already, meaning that a unique
 * regrant cannot be provided.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 */
@SuppressWarnings("serial")
public class AmbiguousRegrantException extends Exception {
  public AmbiguousRegrantException(String path, String key) {
    super(String.format("More than one cap already exists for the path '%s' "
        + "and entity key '%s'", path, key));
  }
}
