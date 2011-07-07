describe('bfriendr back end', function() {
  var capServer;
  var generateAccountRunner;

  beforeEach(function() {
    capServer = new CapServer();
    generateAccountRunner =
      mkRunner(capServer.restore('http://localhost:9009/generate-account'));
  });

  describe('basic account operations', function() {
    var accountRunner;

    beforeEach(function() {
      accountRunner = new InvokeRunner();

      generateAccountRunner.runsGet();
      generateAccountRunner.runsExpectSuccess();
      runs(function() {
        accountRunner.cap = generateAccountRunner.result;
        expect(accountRunner.cap).toBeDefined();
      });
    });

    afterEach(function() {
      accountRunner.runsDelete();
      accountRunner.runsExpectSuccess();
    });

    it('should generate & delete a new account', function() {
      // the beforeEach and afterEach do this test
    });

    it('should save and restore my card info', function() {
      var myCardRunner = new InvokeRunner();
      var initialCard, updatedCard;

      accountRunner.runsGet();
      accountRunner.runsExpectSuccess();

      runs(function() {
        myCardRunner.cap = accountRunner.result.myCard;
        expect(myCardRunner.cap).toBeDefined();
      });

      myCardRunner.runsGet();
      myCardRunner.runsExpectSuccess();
      runs(function() {
        initialCard = myCardRunner.result;
        expect(typeof initialCard.name).toEqual('string');
        expect(initialCard.name).toEqual('');
        expect(typeof initialCard.email).toEqual('string');
        expect(initialCard.email).toEqual('');
        expect(typeof initialCard.notes).toEqual('object');
        expect(initialCard.notes).toEqual(null);
      });

      myCardRunner.runsPut(
        { name: 'fido', email: 'fido@example.com', notes: 'not a dog'});
      myCardRunner.runsExpectSuccess();
      myCardRunner.runsGet();
      myCardRunner.runsExpectSuccess();
      runs(function() {
        updatedCard = myCardRunner.result;
        expect(updatedCard.name).toEqual('fido');
        expect(updatedCard.email).toEqual('fido@example.com');
        expect(updatedCard.notes).toEqual('not a dog');
      });
    });
  });

  describe('account introduction', function() {
    var account1CapRunner;
    var account2CapRunner;
    var account1CardRunner;
    var account2CardRunner;
    var account1Card;
    var account2Card;
    var account2IntroduceRunner;

    beforeEach(function() {
      account1CapRunner = new InvokeRunner();
      account2CapRunner = new InvokeRunner();
      account1CardRunner = new InvokeRunner();
      account2CardRunner = new InvokeRunner();
      account1Card, account2Card;
      account2IntroduceRunner = new InvokeRunner();

      generateAccountRunner.runsGet();
      generateAccountRunner.runsExpectSuccess();
      runs(function() {
        account1CapRunner.cap = generateAccountRunner.result;
        expect(account1CapRunner.cap).toBeDefined();
      });

      generateAccountRunner.runsGet();
      generateAccountRunner.runsExpectSuccess();
      runs(function() {
        account2CapRunner.cap = generateAccountRunner.result;
        expect(account2CapRunner.cap).toBeDefined();
      });

      account1CapRunner.runsGet();
      account1CapRunner.runsExpectSuccess();
      runs(function() {
        account1CardRunner.cap = account1CapRunner.result.myCard;
        expect(account1CardRunner.cap).toBeDefined();
      });

      account2CapRunner.runsGet();
      account2CapRunner.runsExpectSuccess();
      runs(function() {
        account2CardRunner.cap = account2CapRunner.result.myCard;
        expect(account2CardRunner.cap).toBeDefined();
      });

      account1CardRunner.runsPut({ name: 'One', email: 'one@example.com',
        notes: 'nan' });
      account1CardRunner.runsExpectSuccess();

      account2CardRunner.runsPut({ name: 'Two', email: 'two@example.com',
        notes: 'nan' });
      account2CardRunner.runsExpectSuccess();

      account1CardRunner.runsGet();
      account1CardRunner.runsExpectSuccess();
      runs(function() {
        account1Card = account1CardRunner.result;
        expect(account1Card.name == 'One');
      });

      account2CardRunner.runsGet();
      account2CardRunner.runsExpectSuccess();
      runs(function() {
        account2Card = account2CardRunner.result;
        expect(account1Card.name == 'Two');
      });
    });

    afterEach(function() {
      account1CapRunner.runsDelete();
      account1CapRunner.runsExpectSuccess();
      account2CapRunner.runsDelete();
      account2CapRunner.runsExpectSuccess();
    });

    it('should get the card from an introduction cap', function() {
      var account2IntroduceRunner = new InvokeRunner();

      account2IntroduceRunner.cap =
        account2CapRunner.result.introduceYourself;
      expect(account2IntroduceRunner.cap).toBeDefined();
      // Account 1 is doing this call to determine who account 2 is
      account2IntroduceRunner.runsGet();
      account2IntroduceRunner.runsExpectSuccess();
      runs(function() {
        expect(account2IntroduceRunner.result.name).toEqual(account2Card.name);
      });
    });

    it('should let 1 introduce itself to 2', function() {
      var account2IntroduceRunner = new InvokeRunner();

      account2IntroduceRunner.cap =
        account2CapRunner.result.introduceYourself;
      expect(account2IntroduceRunner.cap).toBeDefined();

      account2IntroduceRunner.runsPost({card: account1Card,
                                        stream: 'Account 1 stream'});
      account2IntroduceRunner.runsExpectSuccess();
      runs(function() {
        var bCard = account2IntroduceRunner.result.card;
        expect(bCard.name).toEqual(account2Card.name);
      });

    });

    it('should introduce 1 to 2 via introduceMeTo', function() {
      // TODO(jpolitz): backend currently expects a URL, should expect cap
      var account2Introduce = account2CapRunner.result.introduceYourself;
      var friendRunner = new InvokeRunner();
      var intro1to2Runner = new InvokeRunner();
      var friendListRunner = new InvokeRunner();
      var friendCapRunner = new InvokeRunner();

      friendListRunner.cap = account1CapRunner.result.friends;
      friendListRunner.runsGet();
      runs(function() {
        expect(friendListRunner.result.length).toEqual(0);
      });


      intro1to2Runner.cap = account1CapRunner.result.introduceMeTo;
      intro1to2Runner.runsPost({introductionCap: account2Introduce});
      runs(function() {
        friendRunner.cap = intro1to2Runner.result.friend;
      });

      friendRunner.runsGet();
      runs(function() {
        var friend = friendRunner.result;
        expect(friend.card.name).toEqual(account2Card.name);
      });

      friendListRunner.runsGet();
      runs(function() {
        expect(friendListRunner.result.length).toEqual(1);
        friendCapRunner.cap = friendListRunner.result[0];
      });

      friendCapRunner.runsGet();
      runs(function() {
        expect(friendCapRunner.result.card.name).toEqual('Two');
      });
    });

    it('should allow 1 & 2 to post to on another', function() {
      var account2Introduce = account2CapRunner.result.introduceYourself;
      var friendRunner = new InvokeRunner();
      var intro1to2Runner = new InvokeRunner();
      var postRunner = new InvokeRunner();
      var read1Runner = new InvokeRunner();
      var read2Runner = new InvokeRunner();
      var friendListRunner = new InvokeRunner();
      var friendCapRunner = new InvokeRunner();
      var friendStreamRunner = new InvokeRunner();
      var friendStreamWriter = new InvokeRunner();

      intro1to2Runner.cap = account1CapRunner.result.introduceMeTo;
      intro1to2Runner.runsPost({introductionCap: account2Introduce});
      runs(function() {
        friendRunner.cap = intro1to2Runner.result.friend;
        friendListRunner.cap = account2CapRunner.result.friends;
      });

      friendRunner.runsGet();
      runs(function() {
        var friend = friendRunner.result;
        postRunner.cap = friend.postToMyStream;
        expect(postRunner.cap).toBeDefined();
        read1Runner.cap = friend.readMyStream;
        expect(read1Runner.cap).toBeDefined();
        read2Runner.cap = friend.readTheirStream;
      });

      postRunner.runsPost({ message: 'Hello, friend!' });
      postRunner.runsExpectSuccess();

      read1Runner.runsGet();
      read1Runner.runsExpectSuccess();
      runs(function() {
        var items = read1Runner.result.items;
        expect(items).toBeDefined();
        expect(items.length).toBe(1);
        expect(items[0].message).toEqual('Hello, friend!');
      });

      friendListRunner.runsGet();
      friendListRunner.runsExpectSuccess();
      runs(function() {
        var friends = friendListRunner.result;
        expect(friends.length).toBe(1);
        friendCapRunner.cap = friends[0];
      });

      friendCapRunner.runsGet();
      friendCapRunner.runsExpectSuccess();
      runs(function() {
        var friend = friendCapRunner.result;
        expect(typeof friend.readTheirStream).toBe('object');
        friendStreamRunner.cap = friend.readTheirStream;
        expect(typeof friend.postToMyStream).toBe('object');
        friendStreamWriter.cap = friend.postToMyStream;
      });

      friendStreamRunner.runsGet();
      friendStreamRunner.runsExpectSuccess();
      runs(function() {
        var items = friendStreamRunner.result.items;
        expect(items.length).toBe(1);
        expect(items[0].message).toBe('Hello, friend!');
      });

      friendStreamWriter.runsPost({ message: 'Hello to you, too!' });
      friendStreamWriter.runsExpectSuccess();

      read2Runner.runsGet();
      read2Runner.runsExpectSuccess();
      runs(function() {
        var items = read2Runner.result.items;
        expect(items.length).toBe(1);
        expect(items[0].message).toBe('Hello to you, too!');
      });
    });

    it('should allow reading from combined posts', function() {
      var account2Introduce = account2CapRunner.result.introduceYourself;
      var friend1Runner = new InvokeRunner();
      var friend2Runner = new InvokeRunner();
      var intro1to2Runner = new InvokeRunner();
      var post1Runner = new InvokeRunner();
      var post2Runner = new InvokeRunner();
      var read1Runner = new InvokeRunner();
      var read2Runner = new InvokeRunner();
      var friendListRunner = new InvokeRunner();

      intro1to2Runner.cap = account1CapRunner.result.introduceMeTo;
      intro1to2Runner.runsPost({introductionCap: account2Introduce});
      runs(function() {
        friend1Runner.cap = intro1to2Runner.result.friend;
        friendListRunner.cap = account2CapRunner.result.friends;
      });

      friend1Runner.runsGet();
      runs(function() {
        var friend = friend1Runner.result;
        post1Runner.cap = friend.postToMyStream;
        expect(post1Runner.cap).toBeDefined();
        expect(typeof friend.readConversation).toBe('object');
        read1Runner.cap = friend.readConversation;
      });

      friendListRunner.runsGet();
      friendListRunner.runsExpectSuccess();
      runs(function() {
        var friends = friendListRunner.result;
        expect(friends.length).toBe(1);
        friend2Runner.cap = friends[0];
      });

      friend2Runner.runsGet();
      friend2Runner.runsExpectSuccess();
      runs(function() {
        var friend = friend2Runner.result;
        expect(typeof friend.postToMyStream).toBe('object');
        post2Runner.cap = friend.postToMyStream;
        expect(typeof friend.readConversation).toBe('object');
        read2Runner.cap = friend.readConversation;
      });

      post1Runner.runsPost({ message: 'Hello, friend!' });
      post1Runner.runsExpectSuccess();
      post2Runner.runsPost({ message: 'Hello to you, too!' });
      post2Runner.runsExpectSuccess();
      post2Runner.runsPost({ message: 'How are you?' });
      post2Runner.runsExpectSuccess();
      post1Runner.runsPost({ message: 'Well, thanks.' });
      post1Runner.runsExpectSuccess();

      read1Runner.runsGet();
      read2Runner.runsGet();
      read1Runner.runsExpectSuccess();
      read2Runner.runsExpectSuccess();
      runs(function() {
        var items1 = read1Runner.result.items;
        var items2 = read2Runner.result.items;
        expect(items1.length).toBe(4);
        expect(items2.length).toBe(4);
        expect(items1[3].message).toEqual('Hello, friend!');
        expect(items1[2].message).toEqual('Hello to you, too!');
        expect(items1[1].message).toEqual('How are you?');
        expect(items1[0].message).toEqual('Well, thanks.');
      });

    });
  });
});

