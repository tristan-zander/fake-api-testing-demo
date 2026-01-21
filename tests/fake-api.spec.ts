import { test, expect } from "@playwright/test";
import { Scheduler } from "node:timers/promises";
import z from "zod";

const productSchema = z.object({
  id: z.int(),
  title: z.string(),
  price: z.float64(),
  description: z.string(),
  category: z.string(),
  image: z.url(),
});

// Could import Axios instead, but this is for demonstration without uneeded dependencies.
// Having this as a class potentially allows us to do request/response interceptors
// and the like to make some common test assertions easier. Additionally, authentication
// can be easily handled that way, if the API were not public.
class FakeStoreApi {
  url: URL = new URL("https://fakestoreapi.com/");
  body?: BodyInit;
  headers: Headers = new Headers({
    "Content-Type": "application/json",
    Accept: "application/json",
  });
  method: RequestInit["method"] = "GET";

  async fetch<T>(pathname?: string): Promise<T> {
    const response = await fetch(
      new Request(pathname ? new URL(pathname, this.url.href) : this.url, {
        headers: this.headers,
        body: this.body,
        method: this.method,
      }),
    );

    expect(response.ok).toBeTruthy();

    expect(response.headers.has("Content-Type")).toBeTruthy();
    expect(response.headers.get("Content-Type")).toContain("application/json");

    return (await response.json()) as T;
  }
}

test.describe("fake store tests", () => {
  let api: FakeStoreApi;

  test.beforeEach(() => {
    api = new FakeStoreApi();
  });

  test.describe("products", () => {
    test("get all products", async () => {
      const schema = z.array(productSchema);
      const response = await api.fetch("/products");
      const data = schema.parse(response);

      expect(data.length).toBeGreaterThan(0);
      expect(data[0].id).toBeDefined();
    });

    test("get a specific product", async () => {
      const response = await api.fetch(`/products/${5}`);
      const data = productSchema.parse(response);

      expect(data.id).toBe(5);
      expect(data.title).toBe(
        "John Hardy Women's Legends Naga Gold & Silver Dragon Station Chain Bracelet",
      );
      expect(data.price).toBe(695);
      expect(data.description).toBe(
        "From our Legends Collection, the Naga was inspired by the mythical water dragon that protects the ocean's pearl. Wear facing inward to be bestowed with love and abundance, or outward for protection.",
      );
    });

    test("get all unique categories", async () => {
      const schema = z.array(productSchema);
      const response = await api.fetch("/products");
      const data = schema.parse(response);

      const uniqueCategories = new Set(data.map((d) => d.category));

      expect(uniqueCategories.size).toBe(4);
    });

    // You'd also probably do tests to make sure that each required field causes the test to fail.
    // Fake Store API doesn't appear to actually enforce that.
    test("create product", async () => {
      const requestData: z.infer<typeof productSchema> = {
        id: 40023,
        title: "Lord of the Rings: The Fellowship of the Ring",
        price: 29.95,
        description:
          "Frodo and Sam leave The Shire and things... Gandalf is also there.",
        category: "Fantasy",
        image:
          "https://fakestoreapi.com/img/we-definitely-uploaded-this-photo.jpg",
      };
      productSchema.parse(requestData);

      api.method = "POST";
      api.body = JSON.stringify(requestData);

      const response = await api.fetch("/products");
      const data = productSchema.parse(response);

      expect(data.category).toBe(requestData.category);
      expect(data.id).not.toBe(requestData.id);
      expect(data.title).toBe(requestData.title);
      expect(data.price).toBe(requestData.price);
    });

    test("update product", async () => {
      const updateData: Partial<z.infer<typeof productSchema>> = {
        title: "Eidolon of Blossoms",
        price: 2.95,
        description: "Whenever this creature or another enchantment you control enters, draw a card.",
        category: "Enchantment Creature - Spirit",
      };

      api.method = "PUT";
      api.body = JSON.stringify(updateData);

      const response = await api.fetch<typeof updateData>(`/products/${5}`);

      expect(response.title).toBe(updateData.title);
      expect(response.id).toBe(5);
    });
  });
});
