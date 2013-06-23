---
layout: post
title: Python and Real-time Web
abstract: Introduction to the real-time web capabilities with help of Python
---

Introduction
------------

TBD: .. intro ..

However, in lots of cases, there's need to push updates from the server at will or even have low-latency bi-directional communication between client and the server.

There are different ways to accomplish this and in this post I will try to give introductory explanations of
various techniques used, how to write server in python as well as few hints how to integrate realtime
portion to "conventional" website which is running typical Python Web framework like Flask or Django.

Little Bit of Theory
--------------------

Lets try to solve "push" problem - how is it possible to send data from the server when it is browser who initiates data exchange?

Solution is relatively simple: make AJAX request to the server to ask for updates. While it seems like what's usually happening between browser and server, there's one catch. If server does not have anything to send, it will keep connection open until some data is available for the client. When client receives response, it makes another request to get more data.

This technique is called long-polling.

Obviously, this is not very efficient approach. Noise to signal is very low in most of the cases - it takes longer to
parse HTTP request headers than to send actual payload to the client.

But, unfortunately, it is most compatible way to push data to the client right now.

HTTP/1.1 improved situation a bit. TCP connection state can be controlled by [Keep-Alive](http://en.wikipedia.org/wiki/HTTP_persistent_connection) header and, by default, it
will be kept open after serving request. This feature improved long-polling latency, as there's no need to reopen TCP connection for each polling request.

Another helpful feature was introduction of [chunked transfer encoding](http://wikipedia.org/wiki/Chunked_transfer_encoding) for HTTP response. It allows breaking response into smaller chunks and flush them immediately. There's JavaScript support for chunked encoding as well - it is possible to get notified when another chunk was received by the browser.

Unfortunately, there are lots of incompatible proxies that attempt to cache whole response before sending it further, so client won't receive anything until proxy decided that request was finished. While it is sort of OK for "normal" Web - client will still get response from the server, but it breaks whole idea of using chunked transfer encoding for real-time purposes.

On September 2006, Opera Software implemented experimental [Server-Sent Events](http://en.wikipedia.org/wiki/Server-sent_events) feature for its browser. While its behavior is very similar to chunked transfer encoding, protocol is different and has better client-side API.

SSE was approved by WHATWG on April 23, 2009 and supported by almost all modern desktop browsers (except of Internet Explorer).
You can see compatibility [chart here](http://caniuse.com/#feat=eventsource).

While SSE is a bit more compatible than chunked transfer encoding, but it is not supported by all browsers. And there is
same problem with some misbehaving proxies, but situation is not as bad as with chunked encoding.

There are other techniques as well, like forever-iframe which is only way to do cross-domain push for Internet Explorer versions less than 8, HTMLFile - Internet Explorer version of the server sent events, etc.

Lets see pros and cons of these approaches:

 - Long-polling is expensive, but very compatible;
 - Chunked transfer encoding is more efficient, but there's chance that it won't work for all clients and there's no way
   to know about it without some sort of probing;
 - SSE is efficient as well, but not supported by all browsers. Good think though - there's way to know if it is supported
   or not before establishing connection;

But all these approaches share one problem: they provide ways to push data from the server to the client, but to establish
bi-directional communication, client will have to make AJAX request to the server every time it wants to send some data. This
increases latency and creates extra load on the server.

Meet WebSockets
---------------

While WebSockets are not really new technology, but specification went through few incompatible iterations and finally was released as [RFC 6455](http://tools.ietf.org/html/rfc6455).

In a nutshell, WebSocket is bi-directional connection between server and client over established TCP connection. WebSocket connection is established using ordinary HTTP handshake (with additional WebSocket-related headers) and has additional protocol-level framing, it is not just raw TCP connection opened from the browser.

Biggest problem of the WebSocket protocol is support by browsers, firewalls, proxies and anti-viruses.

Here is browser compatibility [chart](http://caniuse.com/#feat=websockets).

Corporate firewalls usually block WebSocket connections, because it is not possible to inspect data sent over the connection, because data is application specific.

Antiviruses also known to break WebSocket connections going to port 80. For example, older versions of Avast! were treating them as ordinary HTTP connections and attempted to download whole "response" before sending it to the browser.

Anyway, WebSocket is best way to establish bi-directional communication between client and server, but can not be used as
single solution to the problem.

Use Cases
---------

Keeping everything above in mind, if your application mostly pushes data from the server, HTTP-based transports
will work just fine.

However, if browser supports WebSocket connection and it can be established, it is better to use it instead.

To summarize, best approach is: try to open WebSocket connection first and if it fails - try to fall back to one of the HTTP-based transport.

Polyfill Libraries
------------------

Luckily enough, there's no need to implement everything by yourself. It is very hard to work around all known browser, proxy and firewall implementation quirks.

There are some polyfill libraries, like [SockJS](https://github.com/sockjs) or [Socket.IO](http://socket.io/), that implement WebSocket-like API on top of variety of different transport implementation.

While they differ by exposed server and client API, they share common idea: use best transport possible in given circumstances and provide consistent API on the server side.

For example, if browser supports WebSocket protocol, polyfill library will try to establish WebSocket connection. If it fails,
they will fall-back to next best transport and so on. [Engine.IO](https://github.com/LearnBoost/engine.io/) uses slightly
different approach - it establishes long-polling connection and attempts to upgrade to WebSocket in background.

In any case - these libraries will try to establish logical bi-directional connection to the server using best available transport.

Unfortunately, I had poor experience with Socket.IO 0.8.x, and was using SockJS for my projects lately, even though implemented [TornadIO2](https://github.com/mrjoes/tornadio2) - Socket.IO server implementation on top of [Tornado](http://tornadoweb.org/) framework.

Server Side
===========

Lets go back to the Python.

Unfortunately, WSGI-based servers can not be used to create realtime applications, as WSGI protocol is synchronous. WSGI server can only handle one request at the same time.

Lets check long-polling transport again:

  1. Client opens HTTP connection to the server to get more data
  2. No data available, server has to keep connection open and wait for data to send
  3. Because server can't process any other requests, everything else is blocked

In pseudo-code it'll look like this:

{% highlight python %}
def handle_request(request):
    data = get_more_data(request)
    return send_response(data)
{% endhighlight %}

If *get_more_data* blocks, whole server is blocked and can't process requests anymore.

Sure, it is possible to create thread per request, but it is very inefficient.

While there are some workarounds (like approach described by [Armin Ronacher](http://lucumr.pocoo.org/2012/8/5/stateless-and-proud/)), asynchronous execution models fits this task better.

In asynchronous execution model, server still processes requests sequentially and in one thread, but can transfer control to another request handler when there's nothing to do.

In this case, long-polling transport will look like:

 1. Client opens HTTP connection to the server to get more data
 2. No data is available, server keeps TCP connection open and does something else in meanwhile
 3. When there's data to send, server sends it and closes connection

Greenlets
---------

There are two ways to write asynchronous code in Python:

 - Using [coroutines](http://en.wikipedia.org/wiki/Coroutine) (also known as greenlets)
 - Using [callbacks](http://en.wikipedia.org/wiki/Callback_(computer_programming))

In a nutshell, greenlets allow you to write functions that can pause their execution in the middle and then continue their execution later.

Greenlet implementation was back-ported to CPython from [stackless python](http://www.stackless.com/).

Lets check long-polling example again, but with help of greenlets:

 1. Client opens HTTP connection to the server to get more data
 2. Server spawns new greenlet that will be used to handle long-polling logic
 3. There's no data to send, so greenlet sleeps
 4. When there's something to send, greenlet wakes up, sends data and closes connection

In pseudo-code, it looks exactly the same as synchronous version:

{% highlight python %}
def handle_request(request):
    # If there's no data available, greenlet will sleep and execution will be transferred to another greenlet
    data = get_more_data(request)
    return make_response(data)
{% endhighlight %}

Why is greenlets are great? Because they allow writing asynchronous code in synchronous fashion. They allow using existing, synchronous libraries in asynchronous fashion as well. Context switching magic is hidden in greenlet implementation.

[Gevent](http://www.gevent.org/) is excellent example of what can be achieved with greenlets. This framework patches Python standard library to enable asynchronous IO (Input-Output) and makes all code asynchronous without explicit context switching.

On other hand, greenlet implementation for CPython is quite scary. CPython uses unmanaged stack for interpreter and all C extensions and running python application data, so it is quite hard to implement cooperative concurrency. Greenlet attempts to overcome limitation by copying part of the stack to the memory in the heap and back. While it works for most of the cases, especially with tested libraries, but any untested 3rd party extension with C module might create bizarre bugs like stack and heap corruption.

Callbacks
---------

Another way to do context switching is to use callbacks. Long-polling example:

 1. Client opens HTTP connection to the server to get more data
 2. Server sees that there's no data to send
 3. Server waits for data and passes callback function that should be called when there's data available
 4. Server sends response from the callback function

In pseudo-code:
{% highlight python %}
def handle_request(request):
    get_more_data(request, callback=on_data)

def on_data(request):
    send_response(request, make_response(data))
{% endhighlight %}

As you can see, while workflow is similar, but code structure is somewhat different.

Unfortunately, callbacks are not very intuitive and it is nightmare to debug large callback-based applications. Plus, it is hard to make existing "blocking" libraries to work properly with asynchronous application without either rewriting them or using some sort of thread pool.

This also means if you want to talk to database, there should be asynchronous driver for the framework you're using.

Futures
-------

There are different ways to improve situation with callbacks:

 - Using [futures](http://docs.python.org/dev/library/concurrent.futures.html)
 - Using [generators](http://wiki.python.org/moin/Generators)

What is future? First of all, future is a return value from a function. It is an object that has few properties:

 1. State of the function execution (idling, running, stopped, etc)
 2. Return value (might be empty if function is not yet executed)
 2. Various methods: *cancel()* to prevent execution, *add_done_callback* method to register callback function when bound function finishes its execution, etc.

You can check this excellent [blog post](http://blog.jcoglan.com/2013/03/30/callbacks-are-imperative-promises-are-functional-nodes-biggest-missed-opportunity/), which compares promises to callbacks and why they're better than plain callbacks for writing better asynchronous code.

Generators
----------

Python generators can be also used to make asynchronous programmers little bit happier. Long-polling example again, but with help of generators (please note, return from generators is allowed starting from Python 3.3):

{% highlight python %}
@coroutine
def handle_request(request):
    data = yield get_more_data(request)
    return make_response(data)
{% endhighlight %}

As you can see, generators allow writing asynchronous code in sort-of synchronous fashion.

Biggest problem with generators: programmer should know if function is asynchronous or not before calling it.

Consider following example:
{% highlight python %}
@coroutine
def get_mode_data(request):
    data = yield make_db_query(request.user_id)
    return data

def process_request(request):
    data = get_more_data(request)
    return data
{% endhighlight %}

This code won't work as expected, as calling generator function in python returns generator object without executing function. So, in this case, *process_request* should be also made asynchronous (wrapped with *coroutine* decorator) or some other means to execute function should be used.

Another problem - if existing library function should be made asynchronous, all its callers should be updated as well. In some cases, their callers should be updated as well and so on.

Summary
-------

Greenlets make everything "easy" at cost of possible issues, allow implicit context switching.

Code with callbacks is a mess. Futures improve situation. Generators make code easier to read.

It appears that "official" way to write asynchronous applications in Python would be to use callbacks/futures/generators and not greenlets. See [PEP 3156](http://www.python.org/dev/peps/pep-3156/).

Sure, nothing will prevent you from using greenlet-based frameworks as well. Having choice is a good thing.

While Gevent entry barrier is very low - "Oh, look, it just works with my old code", it is quite painful to figure out what went wrong if start seeing stack corruption in production.

I prefer explicit context switching and little bit cautious of greenlets after spending few nights with gdb in production environment figuring out weird interpreter crashes.

Asynchronous Frameworks
-----------------------

In most of the cases, there's no need to write own asynchronous network layer and better to use existing framework. I won't list all asynchronous frameworks here, only ones I worked with, so no offense.

[Gevent](http://www.gevent.org/) is nice, makes writing asynchronous easy, but I had problems with greenlets, so as I wrote before - somewhat cautious.

[Twisted](http://twistedmatrix.com/trac/) is oldest asynchronous framework and is actively maintained up to date. My personal feelings about it are quite mixed: complex, non PEP8, hard to learn.

[Tornado](http://tornadoweb.org) is the framework I stopped on. There are few reasons why:

 - Pythonic
 - Fast
 - Actively developed
 - Source code is easy to read and understand

Tornado is not as big as Twisted and does not have asynchronous ports of some libraries (mostly DB related), but ships with Twisted reactor, so it is possible to use modules written for Twisted on top of Tornado.

I'll use Tornado for all examples going forward, but I'm pretty sure that similar abstractions are available for other frameworks as well.

Tornado
-------

Tornado architecture is pretty simple. There's main loop (called IOLoop). IOLoop checks for IO events on sockets, file descriptors, etc (with help of [epoll](http://en.wikipedia.org/wiki/Epoll), [kqueue](http://en.wikipedia.org/wiki/Kqueue) or [select](http://en.wikipedia.org/wiki/Select_(Unix))) and manages time-based callbacks. When something happens Tornado calls registered callback function.

For example, if there's incoming connection on bound socket, Tornado will call appropriate callback, which will create HTTP request handler class, which will read headers from the socket and so on.

Tornado is more than just a wrapper on top of epoll - it contains own templates, authentication system, asynchronous web client, etc.

If you're not familiar with tornado, take a look at relatively short [framework overview](http://www.tornadoweb.org/en/stable/overview.html).

Tornado comes with WebSocket protocol implementation out of the box and I implemented [sockjs](https://github.com/mrjoes/sockjs-tornado) and [socket.io](https://github.com/mrjoes/tornadio2) libraries on top of it.

As mentioned in beginning of this post, SockJS is WebSocket polyfill library, which exposes WebSocket object on client-side and sockjs-tornado exposes similar API on the server.

It is SockJS concern to pick best available transport and establish logical connection between client and server.

Here's simple chat example with help of sockjs-tornado:

{% highlight python %}
class ChatConnection(sockjs.tornado.SockJSConnection):
    participants = set()

    def on_open(self, info):
        self.broadcast(self.participants, "Someone joined.")
        self.participants.add(self)

    def on_message(self, message):
        self.broadcast(self.participants, message)

    def on_close(self):
        self.participants.remove(self)
        self.broadcast(self.participants, "Someone left.")
{% endhighlight %}

For sake of example, chat does not have any internal protocol or authentication - it just broadcasts messages to all participants.

Yes, that's it. I omitted Tornado initialization and imports though. It does not matter if client does not support WebSocket transport and SockJS fill fall-back to long-polling transport - developer will write code once and sockjs-tornado abstracts protocol differences.

Logic is pretty simple as well:

 - For every incoming SockJS connection, sockjs-tornado will create new instance of the connection class
 - In *on_open*, handler will broadcast to all chat participants that someone joined and add *self* to the participants set
 - If something is received from the client, *on_message* will be called and message will be broadcasted to all participants
 - If client disconnects, *on_close* will remove him from the set and broadcast that he left

Full example, with client side, can be found [here](https://github.com/mrjoes/sockjs-tornado/blob/master/examples/chat/chat.py).

Managing State
--------------

In some cases, to process request from the client, some previous client data should be stored on the server. State adds complexity - it uses memory and it makes scaling harder. For example, without shared session state, clients can only "talk" to one server only. With shared session state - there's additional IO overhead for each transaction to fetch state from the storage.

In most of the cases, it is not possible to implement pure stateless server with any of the HTTP transports. To maintain logical connection, some sort of per-connection session is required to make sure that no data is lost between client polls.

Depending on task, it is possible to split stateful networking layer (long-polling) from stateless business tier (actual application). In this case, business tier worker does not have to be asynchronous at all - it receives task, processes it and sends response back. And because worker is stateless, it is possible to start lots of workers in parallel to increase overall throughput of the application.

Because networking layer is stateful, load balancer in front of application should be aware that it should use sticky sessions for realtime connections. Overall, that's not really an issue with even user distribution between servers behind cluster.

Integrating with WSGI applications
==================================

Obviously, it is not viable to rewrite your existing Web site to use new asynchronous framework. But it is possible to
make them coexist together.

There are two ways to integrate realtime portion:

 1. In process
 2. Out of process

With Gevent, it is possible to make WSGI application coexist in same process with realtime portion. With Tornado and other callback-based frameworks, while it is possible for realtime portion to run in same process (in separate thread) it is not advised for performance reasons (due to [GIL](http://en.wikipedia.org/wiki/Global_Interpreter_Lock)).

And again, I prefer out-of-process approach, where separate set of processes/servers are responsible for realtime portion and they're completely disconnected from the main website. They might be part of one project/repository, but they run side by side.

Lets assume you have social network and want to push status updates in realtime.

Most straightforward way to accomplish this is to create separate server which will handle realtime connections and listen for notifications from main website application.

Notification can happen either through custom REST API exposed by realtime server (works OK for small deployments), through [Redis](http://redis.io/) PUBLISH/SUBSCRIBE functionality (there's high chance your project already uses Redis for something), with help of [ZeroMQ](http://www.zeromq.org/), using AMQP message bus (like [RabbitMQ](http://www.rabbitmq.com/)) and so on.

Structuring your code
---------------------

I'll use Flask as an example, but same can be applied to any other framework (Django, Pyramid, etc).

I prefer having one repository for both Flask application and realtime portion on top of Tornado. In this case, some of the code can be reused between both projects.

For Flask, I use ordinary python libraries: SQLAlchemy, redis-py, etc. For Tornado I have to use asynchronous alternatives
or use thread pool to execute long-running synchronous functions to prevent blocking its ioloop.

Lets check few use cases.

Push broker
-----------

Broker accepts messages from Flask application and forwards them to connected clients. There are lots of ready-to-use
broker implementations ([PubNub](http://www.pubnub.com/), [Pusher](http://pusher.com/), etc), but for some reasons you
might want to roll out your own.

Here's dead simple push broker:
{% highlight python %}
class BrokerConnection(sockjs.tornado.SockJSConnection):
    participants = set()

    def on_open(self, info):
        self.participants.add(self)

    def on_message(self, message):
        pass

    def on_close(self):
        self.participants.remove(self)

    @classmethod
    def pubsub(cls, data):
        msg_type, msg_chan, msg = data
        if msg_type == 'message':
            for c in cls.clients:
                c.send(msg)

if __name__ == '__main__':
    # .. initialize tornado
    # .. connect to redis
    # .. subscribe to key
    rclient.subscribe(v.key, BrokerConnection.pubsub)
{% endhighlight %}

Full example is [here](https://gist.github.com/mrjoes/3284402).

Brokers are stateless - they don't really store any application-specific state, so you can start as many of them as you want to keep up with increased load.

Games
-----

Lets draft an architecture for a "typical" card game.

So, there's a table, which groups players playing same game. Table might also contain visible cards and a deck information. Each player has its internal state - list of cards on hand, as well as some authentication data.

Also, for the game, client should be a little bit smarter as there's need to have custom protocol on top of raw connection. For simplicity, we'll use custom JSON-based protocol.

Lets figure out what kind of messages we need:

 - Authentication
 - Error
 - Room list
 - Join room
 - Take card
 - Put card
 - Leave room

Authentication message will be first message sent from the client to the server. For example, it can look like:
{% highlight json %}
{"msg": "auth", "token": "[encrypted-token-in-base64]"}
{% endhighlight %}

Payload is encrypted token, generated by Flask application. One way to generate token: get current user ID, add some salt with time stamp and encrypt it with some symmetric algorithm (like 3DES or AES) with a shared secret between. Tornado can decrypt the token, get user ID out of it and make a query from database to get necessary information about user.

Room list can be represented by something like:
{% highlight json %}
{"msg": "room_list", "rooms": [{"name": "room1"}, {"name": "room2"}]}
{% endhighlight %}

And so on.

On the server side, as every SockJS connection is encapsulated in instance of the class, it is possible to use *self* to store any player related data.

Connection class can look like (part of it):
{% highlight python %}
class GameConnection(SockJSConnection):
    def on_open(self, info):
        self.authenticated = False

    def on_message(self, data):
        msg = json.loads(data)
        msg_type = msg['msg']

        if not self.authenticated and msg_type != 'auth':
            self.send_error('authentication required')
            return

        if msg_type == 'auth':
            self.handle_auth(msg)
            return
        elif msg_type == 'join_room':
            # ... other handlers
            pass

    def handle_auth(self, msg):
        user_id = decrypt_token(msg['token'])
        if user_id is None:
            self.send_error('invalid token')
            return
        self.send_room_list()

    def send_error(self, text):
        self.send(json.dumps({'msg': 'error', 'text': text}))
{% endhighlight %}

Rooms can be stored in a dictionary, there key is room ID and value is room object.

By implementing different message handlers and appropriate logic on client-side, we can have our game working, which is left as an exercise to the reader.

Games are stateful - server has to keep track of what's happening in the game. This also means that it is somewhat harder to scale it.

In example above, one server will handle all games for all connected players. But what if we need to start two servers? As they don't know about each one state, players connected to first server won't be able to play with players from second server. While it might work in some cases, especially when there's region based player distribution, it won't really work


Deployment
----------

It is good idea to serve both Flask and Tornado portions behind the load balancer (like [haproxy](http://haproxy.1wt.eu/)) or reverse caching proxy (i.e. [nginx](http://nginx.org/), but use newest versions with WebSocket protocol support).

There are three deployment options:

 1. Serve both Web and realtime portions from the same host and port
 2. Serve Web server on port 80 and realtime portion on different port
 3. Serve Web server on main domain (site.com) and realtime portion on subdomain (subdomain.site.com)

Each approach has its advantages and disadvantages:

 1. Everything looks consistent and comes from one domain and port, so cross-domain scripting policies don't kick in. Usually
    works with restrictive firewalled environments, unless they also have transparent proxy that does not understand
    WebSocket protocol;
 2. Usually more compatible with various transparent proxies, but does not work in restrictive environments;
 3. Realtime portion is logically decoupled from the main Website. Has same problems as first option.

Also, I saw suggestion to use Gevent and make realtime portion coexist with "normal" website in the same process. I'm not sure it is good idea and prefer to split conventional Web application and realtime portion into separate processes.

Scaling
-------

It is very easy to scale stateless servers - just start new worker process, update load balancer and you're set.

With stateful servers it is harder. Depending on application type, there are few things that can be done. Lets take
card game as an example.

Simplest way to achieve this: host different tables on different servers and make users connect these servers if they
want to play in particular table. It is a bit hacking, but it will work for simple cases.

Better way to do it is to abstract game logic into separate application server and use SockJS as a smart proxy between
client and game server. You can use ZeroMQ for communication inside of the cluster instead of Redis, so Redis is no longer
central point of failure.

Anyway, that's quite large topic to cover in introductory article.

Real-life experience
--------------------

I saw few success stories with sockjs-tornado: [PlayBuildy](http://blog.playbuildy.com/), [PythonAnywhere](http://blog.pythonanywhere.com/27/) and some others.

But, unfortunately, I didn't use it myself for large projects.

However, I have quite interesting experience with [sockjs-node](https://github.com/sockjs/sockjs-node) - SockJS server implementation for [nodejs](http://nodejs.org/). I implemented realtime portion for existing website for relatively large radio station. At average, there are around 5k connected clients at the same time.

Most connections are short-lived and server is more than just a simple broker: it manages hierarchical channels and channel backlog. Client can subscribe to the channel and should receive all updates pushed to any of the child channels. Client can also request backlog - last N messages sorted by date for channel and its children. So there was a bit of logic on the server as well.

Overall, nodejs performance is great - 2 instances on one server are able to keep up with all these clients.

But there were too many different problems with nodejs or its libraries to my taste.

After deploying to production, server started leaking memory for no apparent reason. All tools showed that heap size is constant, but RSS of the server process kept growing until process was killed by the OS. As a quick solution, nodejs server was restarted every night.

Upgrading to newer nodejs version helped, until process started crashing with no apparent reason without generating coredump.

And again, upgrading to newer nodejs version helped, until V8 garbage collector started locking up in some cases and it was happening once a day.

Newer nodejs version solved garbage collector issue and application is working again.

Also, callback-based programming style makes code not as clean and readable as I wanted it to be.

To sum it up - even though nodejs does its job, I had strong feeling that it is not as mature as Python. And I'd rather use Python for such task in the future, so I can be sure that if something goes wrong, it is happening because I failed and issue can be traced relatively easy.

Performance-wise, with WebSocket transport, CPython is on par with nodejs and PyPy is much faster. For long-polling, Tornado on PyPy is approximately 1.5-2 times slower than nodejs when used with proper asynchronous libraries. So it is comparable at least.

Final notes
-----------

I hope this post will help you to get started with realtime Web using Python.

If you have any comments, questions or updates - feel free to contact me.
