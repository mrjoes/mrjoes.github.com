---
layout: post
title: Flask-AdminEx
abstract: Admininstrative interface framework for Flask
---

Pleased to annouce small, yet powerful administrative interface building framework for Flask.

Flask-AdminEx is not limited to model scaffolding - you can implement interface of any complexity. And it comes
with few batteries built in: SQLAlchemy model scaffolding and simple file management interface.

Here's simple model interface:

{% highlight python %}
from flask import Flask
from flaskext.sqlalchemy import SQLAlchemy

from flask.ext import adminex
from flask.ext.adminex.ext import sqlamodel

# Create application
app = Flask(__name__)
db = SQLAlchemy(app)

# Setup app and create models here

if __name__ == '__main__':
    admin = adminex.Admin(app, 'Simple Models')
    admin.add_view(sqlamodel.ModelView(User, db.session))
    admin.add_view(sqlamodel.ModelView(Post, db.session))
    app.run()
{% endhighlight %}

Which will look like this:

<a href="http://flask-adminex.readthedocs.org/en/latest/_images/quickstart_4.png">
  <img src="http://flask-adminex.readthedocs.org/en/latest/_images/quickstart_4.png" width="640" alt="Screenshot"></img>
</a>

For more information, check [documentation](http://flask-adminex.readthedocs.org/) or browse [GitHub](https://github.com/MrJoes/Flask-AdminEx/)
