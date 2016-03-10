var app = angular.module('codecraft', [
	'ngResource',
	'infinite-scroll',
	'angularSpinner',
	'jcs-autoValidate',
	'angular-ladda',
	'mgcrea.ngStrap',
    'toaster',
    'ngAnimate',
	'ui.router'
]);

app.config(function($stateProvider, $urlRouterProvider){
	$stateProvider
		.state('list', {
			url: '/',
			views: {
				'main':{
					templateUrl: 'templates/list.html',
					controller: 'PersonListController'
				},
				'search':{
                    templateUrl: 'templates/searchform.html',
                    controller: 'PersonListController'
				}
			}
		})
		.state('edit', {
			url: '/edit/:email',
			views: {
				'main':{
					templateUrl: 'templates/edit.html',
					controller: 'PersonDetailController'
				}
			}
		})
        .state('create', {
            url: '/create',
			views: {
				'main':{
					templateUrl: 'templates/edit.html',
					controller: 'PersonCreateController'
				}
			}
        });

	$urlRouterProvider.otherwise('/');

});

app.config(function($httpProvider, $resourceProvider, laddaProvider, $datepickerProvider){
	$httpProvider.defaults.headers.common['Authorization'] = 'Token 1119d3b36fea1a895abd39d1660636dc57d284ff'
	$resourceProvider.defaults.stripTrailingSlashes = false;
	laddaProvider.setOption({	style: 'expand-right' });
    angular
        .extend($datepickerProvider.defaults, {
            dateFormat: 'd/M/yyyy',
            autoclose: true
        })
});

app.factory('Contact', function($resource){
	return $resource("https://codecraftpro.com/api/samples/v1/contact/:id/",
		{id:'@id'},
		{update: {method:'PUT'}});
});

app.directive('ccSpinner', function(){
    return {
        'restrict':'AE',
        'templateUrl':'templates/spinner.html',
        'scope':{
            'isLoading':'='
        }
    }
})

app.directive('ccCard', function(){
    return {
        'restrict':'AE',
        'templateUrl':'templates/card.html',
        'scope':{
			'user': '='
        },
        'controller':function($scope, ContactService){
            $scope.isDeleting = false;
            $scope.deleteUser = function(){
                $scope.isDeleting = true;
                ContactService
                    .removeContact($scope.user)
                    .then(function(){
                        $scope.isDeleting = false;
                    })
            }
        }
    }
})

app.filter('defaultImage', function(){
    return function(input, param){
        if (!input){
            return param
        }
        return input;
    };
});

app.controller('PersonDetailController', function ($scope, $state, $stateParams, ContactService) {

    $scope.mode = 'Edit';
    $scope.contacts = ContactService;
    $scope.contacts.selectedPerson = ContactService.getPerson($stateParams.email);

	$scope.save = function(){
		ContactService
            .updateContact(ContactService.selectedPerson)
            .then(function(){
                $state.go('list');
            });
	};

	//$scope.remove = function(){
	//	ContactService
     //       .removeContact(ContactService.selectedPerson)
     //       .then(function(){
     //           $state.go('list');
     //       });
	//};


});

app.controller('PersonListController', function ($scope, $modal, ContactService) {

	$scope.search = "";
	$scope.order = "email";
	$scope.contacts = ContactService;

	$scope.loadMore = function(){
		console.log('end of page');
		$scope.contacts.loadMore();
	};

});

app.controller('PersonCreateController', function ($scope, $state, ContactService) {

    $scope.mode = 'Create';

    $scope.contacts = ContactService;

    $scope.save = function(){
        console.log('createContact');
        ContactService
            .createContact($scope.contacts.selectedPerson)
            .then(function(){
                $state.go('list');
            })
    };

});

app.service('ContactService', function (Contact, $rootScope, $q, toaster) {

	var self = {
		'getPerson': function (email) {
			for (var i=0; i<self.persons.length; i++){
				var obj = self.persons[i];
				if (obj.email == email){
					return obj;
				}
			}
		},
		'page':1,
		'hasMore':true,
		'isLoading':false,
		'isSaving':false,
		'selectedPerson': null,
		'persons': [],
		'search': null,
        'ordering': 'name',
		'doSearch': function(){
			self.hasMore = true;
			self.page = 1;
			self.persons = [];
			self.loadContacts();
		},
		'doOrder': function(){
			self.hasMore = true;
			self.page = 1;
			self.persons = [];
			self.loadContacts();
		},
		'loadContacts':function(){
			if (self.hasMore && !self.isLoading){
				self.isLoading = true;

				var params = {
					'page': self.page,
					'search': self.search,
					'ordering': self.ordering
				};

				Contact.get(params, function(data){
					console.log(data);
					angular.forEach(data.results, function(person){
						self.persons.push(new Contact(person));
					});

					if (!data.next){
						self.hasMore = false;
					}
					self.isLoading = false;
				});
			}

		},
		'loadMore': function() {
			if (self.hasMore && !self.isLoading) {
				self.page += 1;
				self.loadContacts();
			}
		},
		'updateContact': function(person){
            var d = $q.defer();
            console.log('Update');
			self.isSaving = true;
			Contact
				.update(person)
				.$promise
				.then(function(){
					self.isSaving = false;
                    toaster.pop('success', 'Updated ' + person.name);
                    d.resolve();
                });
            return d.promise;
        },
		'removeContact': function(person){
            var d = $q.defer();

            console.log('Remove');
			self.isDeleting = true;
			person
				.$remove()
				.then(function(){
					self.isDeleting = false;
					var idx = self.persons.indexOf(person);
					self.persons.splice(idx, 1);
					self.selectedPerson = null;
                    toaster.pop('success', 'Deleted ' + person.name);
                    d.resolve();
                });
            return d.promise;
        },
        'createContact': function(person){
            var d = $q.defer();
            self.isSaving = true;
            Contact
                .save(person)
                .$promise
                .then(function(){
                    self.isSaving = false;
                    self.selectedPerson = null;
                    self.hasMore = true;
                    self.page = 1;
                    self.persons = [];
                    self.loadContacts();
                    toaster.pop('success', 'Created ' + person.name);
                    d.resolve();
                });
            return d.promise;
        },
        'watchFilters': function(){
            console.log('watchFilters fired');
            $rootScope
                .$watch(
                    function(){ return self.search; },
                    function(newVal){
                        if (angular.isDefined(newVal)) {
                            console.log('search changed');
                            self.doSearch();
                        }
                    }
                );

            $rootScope
                .$watch(
                    function(){ return self.ordering; },
                    function(newVal){
                        console.log('ordering changed');
                        if (angular.isDefined(newVal)) {
                            self.doOrder();
                        }
                    }
                );
        }
	};

	self.loadContacts();
	self.watchFilters();

	return self;

});