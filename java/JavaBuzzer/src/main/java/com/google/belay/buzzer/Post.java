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

import javax.jdo.annotations.Extension;
import javax.jdo.annotations.IdGeneratorStrategy;
import javax.jdo.annotations.PersistenceCapable;
import javax.jdo.annotations.Persistent;
import javax.jdo.annotations.PrimaryKey;

/**
 * Data model for an individual post to a buzzer instance.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 * 
 */
@PersistenceCapable
public class Post implements Comparable<Post> {

  @PrimaryKey
  @Persistent(valueStrategy = IdGeneratorStrategy.IDENTITY)
  @Extension(vendorName = "datanucleus", key = "gae.encoded-pk", value = "true")
  @HideFromClient
  private String key;

  @Persistent
  private String content;

  @Persistent
  private long timestamp;

  @Persistent
  private String via;

  public Post(String content, long timestamp, String via) {
    this.content = content;
    this.timestamp = timestamp;
    this.via = via;
  }

  public String getKey() {
    return key;
  }

  public String getContent() {
    return content;
  }

  public void setContent(String content) {
    this.content = content;
  }

  public long getTimestamp() {
    return timestamp;
  }

  public void setTimestamp(long timestamp) {
    this.timestamp = timestamp;
  }

  public String getVia() {
    return via;
  }

  public void setVia(String via) {
    this.via = via;
  }

  /**
   * Sorts posts in reverse chronological order.
   */
  @Override
  public int compareTo(Post o) {
    return (int) Math.signum(o.timestamp - this.timestamp);
  }
}
