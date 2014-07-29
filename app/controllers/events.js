var controller = require('stackers'),
	_          = require('underscore'),
	moment     = require('moment'),
	Promise    = require('bluebird'),
	config     = require('../../conf');

_.str = require('underscore.string');

var Events  = require('../collections/events'),
	Tickets = require('../collections/tickets'),
	MailCollection = require('../collections/mailchimp'),
	Users   = require('../collections/users');

var eventsController = controller({
	path : 'eventos'
});

eventsController.beforeEach(function(req, res, next){
	res.data.analytics = config.analytics || '';

	next();
});

var renderActive = function(event, req, res){
	//hardcodeando el idioma
	moment.lang('es');
	/*jshint camelcase:false */
	var tickets = new Tickets();
	var users   = new Users();

	//TODO: esto realmente va en el modelo
	var placeUrls = {
		centraal: 'https://www.google.com/maps/place/Centraal/@19.412084,-99.' +
		'180576,17z/data=!3m1!4b1!4m2!3m1!1s0x85d1ff5c96fc9085:0x2f6aec40a6a0a8b0'
	};

	var dateTime = moment(event.get('date') + ' ' + event.get('hour_start'));
	event.set('date_start', dateTime);
	var place = event.get('place').toLowerCase();
	if (placeUrls[place]) {
		event.set('embed', placeUrls[place]);
	}
	var data = {
		event : event.toJSON(),
		user : req.session.passport.user
	};

	var userTicket;

	var qTickets = tickets.fetchFilter(function(item) {
		return item.event === event.get('slug');
	});

	qTickets.then(function(){
		if(req.session.passport.user && req.session.passport.user.username){
			userTicket = tickets.find(function(item){
				return item.get('user') === req.session.passport.user.username;
			});
		}

		if( userTicket ){ data.hasTicket = true;}

		// Populate avatar
		return users.fetchFilter(function(user){
			var avatarTicket = tickets.find(function(ticket){
				return ticket.get('user') === user.username;
			});

			if(avatarTicket){
				avatarTicket.set('avatar', user.data.avatar_url);
			}

			if(userTicket && userTicket.get('user') === user.username){
				if( MailCollection.findWhere({euid:user.euid}) ){
					userTicket.set('hasNewsletter', true);
				}

				var emails = user.emails;

				if(user.email){
					userTicket.set('email', user.email);
				} else if( !(user.email !== null || user.email !== undefined) && emails.length){
					userTicket.set('email', emails[0].value);
				}
			}
		});
	}).then(function(){
		data.attendees = tickets.toJSON();
		if(userTicket){
			data.userTicket = userTicket.toJSON();
		}

		res.render('events/active',data);
	}).catch(function(err){
		res.send(500, err);
	});
};

var renderOngoing = function(event, req, res){
	/*jshint camelcase:false */
	var tickets = new Tickets();
	var users   = new Users();

	var data = {
		event : event.toJSON(),
		user : req.session.passport.user
	};

	var qTickets = tickets.fetchFilter(function(item) {
		return item.event === event.get('slug');
	});

	qTickets.then(function(){
		var userTicket, userUsedTicket;
		if(req.session.passport.user && req.session.passport.user.username){
			userTicket = tickets.find(function(item){
				return item.get('user') === req.session.passport.user.username;
			});

			userUsedTicket = tickets.find(function(item){
				return item.get('user') === req.session.passport.user.username && item.get('used');
			});
		}

		if( userTicket ){ data.hasTicket = true;}
		if( userUsedTicket ){ data.hasUsedTicket = true; }
		
		// Populate avatar
		return users.fetchFilter(function(user){
			var avatarTicket = tickets.find(function(ticket){
				return ticket.get('user') === user.username;
			});

			if(avatarTicket){
				avatarTicket.set('avatar', user.data.avatar_url);
			}
		});
	}).then(function(){
		data.attendeesOnEvent = tickets.filter(function(item){
			return item.get('used');
		}).map(function(item){
			return item.toJSON();
		});

		data.attendeesNotEvent = tickets.filter(function(item){
			return !item.get('used');
		}).map(function(item){
			return item.toJSON();
		});

		res.render('events/ongoing',data);
	}).catch(function(err){
		res.send(500, err);
	});
};

var renderFinished = function(event, req, res){
	/*jshint camelcase:false */
	var tickets = new Tickets();
	var users   = new Users();

	var data = {
		event : event.toJSON(),
		user : req.session.passport.user
	};

	var qTickets = tickets.fetchFilter(function(item) {
		return item.event === event.get('slug');
	});

	qTickets.then(function(){
		var userTicket, userUsedTicket;
		if(req.session.passport && req.session.passport.user && req.session.passport.user.username){
			userTicket = tickets.find(function(item){
				return item.get('user') === req.session.passport.user.username;
			});

			userUsedTicket = tickets.find(function(item){
				return item.get('user') === req.session.passport.user.username && item.get('used');
			});
		}

		if( userTicket ){ data.hasTicket = true;}
		if( userUsedTicket ){
			data.hasUsedTicket = true;
			data.currentTicket = userUsedTicket.toJSON();
		}

		// Populate avatar
		return users.fetchFilter(function(user){
			var avatarTicket = tickets.find(function(ticket){
				return ticket.get('user') === user.username;
			});

			if(avatarTicket){
				avatarTicket.set('avatar', user.data.avatar_url);
			}
		});
	}).then(function(){
		data.attendees = tickets.filter(function(item){
			return item.get('used');
		}).map(function(item){
			return item.toJSON();
		});

		data.reviews = tickets.filter(function(item){
			return item.get('review');
		}).map(function(item){
			return item.toJSON();
		});

		res.render('events/finished',data);
	}).catch(function(err){
		res.send(500, err);
	});
};

eventsController.get('/:slug', function (req, res) {
	var events  = new Events();

	events.fetchOne(function(item){
		return item.slug === req.params.slug &&
			item.type === Events.Types.MEETUP;
	}).then(function(event){
		if(!event){ return res.send(404, 'Event not found');}

		if( event.get('status') === 'active' ){renderActive(event, req, res);}
		if( event.get('status') === 'ongoing' ){renderOngoing(event, req, res);}
		if( event.get('status') === 'finished' ){renderFinished(event, req, res);}
	});
});

eventsController.post('/:slug/ticket', function (req, res) {
	var events = new Events(),
		tickets = new Tickets(),
		event;

	var qEvents = events.fetchFilter(function(item) {
		return item.slug === req.params.slug;
	});

	var qTickets = tickets.fetchFilter(function(item) {
		return	item.user === req.session.passport.user.username &&
				item.event === req.params.slug;
	});

	Promise.all([qEvents, qTickets]).then(function() {
		if (!events.length) return res.send(404);
		event = events.first();

		if (tickets.length){return res.redirect('/eventos/'+event.get('slug')+'?ticket=success');}

		var newTicket = {
			event  : event.get('slug'),
			user   : req.session.passport.user.username,
			used   : false
		};

		var ticket = tickets.add(newTicket);
		return ticket.save();
	}).then(function() {
		res.redirect('/eventos/'+event.get('slug')+'?ticket=success');
	}).catch(function (err) {
		res.send(500, err);
	});
});

eventsController.post('/:slug/check-in', function(req, res){
	var tickets = new Tickets();

	tickets.fetchFilter(function(item){
		return item.user  === req.session.passport.user.username &&
			item.event === req.params.slug;
	}).then(function(){
		var ticket;

		if(tickets.length > 0){
			// set ticket as used
			ticket = tickets.first();
			ticket.set('used', true);
		}else{
			// create ticket
			var ticketData = {
				event  : req.params.slug,
				user   : req.session.passport.user.username,
				used   : true
			};

			ticket = tickets.add(ticketData);
		}
		
		return ticket.save();
	}).then(function(){
		res.redirect('/eventos/'+ req.params.slug );
	}).catch(function(err){
		res.send(500, err);
	});
});

eventsController.post('/:slug/review', function(req, res){
	var tickets = new Tickets();

	tickets.fetchFilter(function(item){
		return item.user  === req.session.passport.user.username &&
			item.event === req.params.slug;
	}).then(function(){
		var ticket;

		if(tickets.length === 0){
			res.send(404, 'Not an attendee');
		}else{
			ticket = tickets.first();
			ticket.set('review', req.body.review);

			return ticket.save();
		}
	}).then(function(){
		res.redirect('/eventos/'+ req.params.slug + '?review=success');
	}).catch(function(err){
		res.send(500, err);
	});
});

module.exports = eventsController;
