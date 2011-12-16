---
layout: post
title: sockjs-tornado
abstract: SockJS python server implementation on top of Tornado
---

What is SockJS?
---------------
SockJS is a browser JavaScript library that provides a WebSocket-like object. SockJS gives you a coherent, cross-browser, Javascript API which creates a low latency, full duplex, cross-domain communication channel between the browser and the web server.

Under the hood SockJS tries to use native WebSockets first. If that fails it can use a variety of browser-specific transport protocols and presents them through WebSocket-like abstractions.

SockJS is intended to work for all modern browsers and in environments which don't support WebSocket protcol, for example behind restrictive corporate proxies.

If you worked with [socket.io](http://socket.io/) before, you might think that it is another socket.io spin-off. Well, there are some major differences between these two libraries:

* SockJS is designed with scalability in mind. I don't want to go into details here, but it is very easy to load balance
  connections by just using data stored in the URL.
* SockJS follows HTML5 Websockets API as closely as possible. So, switching to native implementation should be painless. On other
  hand, current stable socket.io version exposes higher level API, which is not compatible with Websocket spec. This also means,
  that SockJS sends strings, while socket.io is smart enough to send json data, etc.
* SockJS implements at least one streaming protocol for every major browser. Since version 0.7, socket.io does not support any
  streaming transports - only websockets (or flashsockets fallback) and various polling transports.
* SockJS has very simple protocol and very good documentation. Also, there is excellent 
  [test suite](https://github.com/sockjs/sockjs-protocol) for backend developers, so they verify their SockJS server 
  implementation. So, SockJS enforces certain behavioral patterns and expects all server implementations confirm to the protocol
  test.
* There is no flashsocket fallback, because it does not work for most of the time.


sockjs-tornado
--------------

[sockjs-tornado](http://github.com/mrjoes/sockjs-tornado/) is SockJS implementation on top of [Tornado](http://www.tornadoweb.org/) 
framework. It is very fast (details will be posted soon), passes sockjs-protocol test and just works.

If you worked with [TornadIO](http://github.com/mrjoes/tornadio/), you will find API very similar. This is
a simple echo server:

{% highlight python %}
from tornado import web, ioloop
from sockjs.tornado import SockJSRouter, SockJSConnection

class EchoConnection(SockJSConnection):
    def on_message(self, msg):
        self.send(msg)

if __name__ == '__main__':
    EchoRouter = SockJSRouter(EchoConnection, '/echo')

    app = web.Application(EchoRouter.urls)
    app.listen(9999)
    ioloop.IOLoop.instance().start()
{% endhighlight %}

What's pending?
---------------

Right now, I'm finishing qunit benchmarks and updating documentation. Should be done very soon.

Anyway, hope you'll like it.
