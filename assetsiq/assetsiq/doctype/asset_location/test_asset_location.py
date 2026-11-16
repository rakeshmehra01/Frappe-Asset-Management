# Copyright (c) 2026, Rakesh Mehra and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase

IGNORE_TEST_RECORD_DEPENDENCIES = ["Country", "Location State", "Location District"]


class IntegrationTestAssetLocation(IntegrationTestCase):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.prefix = "AIQ Geo Test " + frappe.generate_hash(length=8)
		countries = frappe.get_all("Country", pluck="name", order_by="name", limit=2)
		self.assertEqual(len(countries), 2)
		self.country_a, self.country_b = countries
		self.state_a = self.make_state(self.country_a, self.prefix + " Region")
		self.state_b = self.make_state(self.country_b, self.prefix + " Region")
		self.state_c = self.make_state(self.country_a, self.prefix + " Other Region")
		self.district_a = self.make_district(self.state_a.name, self.prefix + " District")
		self.district_b = self.make_district(self.state_c.name, self.prefix + " District")

	def make_state(self, country, name):
		return frappe.get_doc({"doctype": "Location State", "country": country, "state_name": name}).insert()

	def make_district(self, state, name):
		return frappe.get_doc({"doctype": "Location District", "state": state, "district_name": name}).insert()

	def location(self, **values):
		return frappe.get_doc({"doctype": "Asset Location", **values})

	def test_valid_hierarchy_and_reload_preserve_values(self):
		doc = self.location(country=self.country_a, state=self.state_a.name, district=self.district_a.name).insert()
		doc.reload()
		doc.save()
		self.assertEqual((doc.country, doc.state, doc.district),
			(self.country_a, self.state_a.name, self.district_a.name))

	def test_country_only_remains_allowed(self):
		doc = self.location(country=self.country_a).insert()
		self.assertFalse(doc.state)
		self.assertFalse(doc.district)

	def test_state_requires_country(self):
		with self.assertRaises(frappe.ValidationError):
			self.location(state=self.state_a.name).insert()

	def test_state_cannot_belong_to_another_country(self):
		with self.assertRaises(frappe.ValidationError):
			self.location(country=self.country_b, state=self.state_a.name).insert()

	def test_district_requires_state(self):
		with self.assertRaises(frappe.ValidationError):
			self.location(country=self.country_a, district=self.district_a.name).insert()

	def test_district_cannot_belong_to_another_state(self):
		with self.assertRaises(frappe.ValidationError):
			self.location(country=self.country_a, state=self.state_a.name,
				district=self.district_b.name).insert()

	def test_api_country_edit_cannot_keep_incompatible_children(self):
		doc = self.location(country=self.country_a, state=self.state_a.name,
			district=self.district_a.name).insert()
		doc.country = self.country_b
		with self.assertRaises(frappe.ValidationError):
			doc.save()

	def test_duplicate_names_scoped_to_parent(self):
		self.assertEqual(self.state_a.state_name, self.state_b.state_name)
		self.assertEqual(self.district_a.district_name, self.district_b.district_name)
		with self.assertRaises(frappe.DuplicateEntryError):
			self.make_state(self.country_a, "  " + self.state_a.state_name + "  ")
		with self.assertRaises(frappe.DuplicateEntryError):
			self.make_district(self.state_a.name, "  " + self.district_a.district_name + "  ")

	def test_parent_changes_are_blocked_but_label_corrections_work(self):
		self.state_a.state_name += " Corrected"
		self.state_a.save()
		self.state_a.country = self.country_b
		with self.assertRaises(frappe.ValidationError):
			self.state_a.save()
		self.district_a.state = self.state_c.name
		with self.assertRaises(frappe.ValidationError):
			self.district_a.save()

	def test_native_link_queries_filter_by_parent(self):
		from frappe.desk.search import search_link
		states = search_link("Location State", self.prefix, filters={"country": self.country_a})
		self.assertEqual({row["value"] for row in states}, {self.state_a.name, self.state_c.name})
		districts = search_link("Location District", self.prefix, filters={"state": self.state_a.name})
		self.assertEqual({row["value"] for row in districts}, {self.district_a.name})

	def test_employee_can_select_geography_but_not_manage_it(self):
		email = f"aiq-geo-{frappe.generate_hash(length=8)}@example.test"
		frappe.get_doc({"doctype": "User", "email": email, "first_name": "Geography test",
			"send_welcome_email": 0, "user_type": "System User",
			"roles": [{"role": "AssetsIQ Employee"}]}).insert()
		frappe.set_user(email)
		try:
			for doctype in ("Location State", "Location District"):
				self.assertTrue(frappe.has_permission(doctype, "read"))
				self.assertTrue(frappe.has_permission(doctype, "select"))
				self.assertFalse(frappe.has_permission(doctype, "write"))
				self.assertFalse(frappe.has_permission(doctype, "create"))
		finally:
			frappe.set_user("Administrator")
