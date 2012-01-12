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

package com.google.belay.buzzer;

import com.google.belay.server.HideFromClient;

import java.util.SortedSet;
import java.util.TreeSet;

import javax.jdo.annotations.Extension;
import javax.jdo.annotations.IdGeneratorStrategy;
import javax.jdo.annotations.PersistenceCapable;
import javax.jdo.annotations.Persistent;
import javax.jdo.annotations.PrimaryKey;

/**
 * Data model for an individual buzzer instance.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 * 
 */
@PersistenceCapable
public class Buzzer {

  @PrimaryKey
  @Persistent(valueStrategy = IdGeneratorStrategy.IDENTITY)
  @Extension(vendorName = "datanucleus", key = "gae.encoded-pk", value = "true")
  @HideFromClient
  private String key;

  @Persistent
  private String name;

  @Persistent
  private String authorInfo;

  @Persistent(defaultFetchGroup = "true")
  private SortedSet<Post> posts = new TreeSet<Post>();

  public Buzzer(String name) {
    this.name = name;
  }

  public Buzzer() {
    // no-arg constructor for Gson
  }

  public String getKey() {
    return key;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getAuthorInfo() {
    return authorInfo;
  }

  public void setAuthorInfo(String authorInfo) {
    this.authorInfo = authorInfo;
  }

  public SortedSet<Post> getPosts() {
    return posts;
  }

  public void setPosts(SortedSet<Post> posts) {
    this.posts = posts;
  }
}
