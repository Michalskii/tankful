---
id: how-to-calculate
order: 4
slug: jak-obliczyc-koszt-paliwa
title: Obliczanie kosztu paliwa na trasę – wzór, przykłady i kalkulator | Tankful
heading: Jak obliczyć koszt paliwa na trasę – wzór i przykłady
description: Prosty wzór na koszt paliwa na trasę, przykłady z aktualnymi cenami, przejazd tam i z powrotem, podróż przez kilka krajów i najczęstsze błędy w liczeniu.
published: 2026-09-30
---
Koszt paliwa na trasę liczy się jednym wzorem:

> **koszt = dystans (km) ÷ 100 × spalanie (l/100 km) × cena za litr**

Na przykład trasa [Warszawa – Kraków](trasa/warszawa-krakow) ma {{km warszawa-krakow}} km. Auto palące 7 l/100 km zużyje na niej {{litres warszawa-krakow 7}} litrów benzyny, co przy średniej cenie {{price PL pb}} daje **{{trip warszawa-krakow pb 7}}** w jedną stronę.

## Krok po kroku

1. **Sprawdź dystans** trasy, którą faktycznie pojedziesz – w nawigacji albo w kalkulatorze. Najkrótsza trasa nie zawsze jest najszybsza, a różnica potrafi mieć kilkadziesiąt kilometrów.
2. **Weź realne spalanie**, najlepiej z komputera pokładowego z jazdy w trasie. Spalanie w mieście i na autostradzie mocno się różni.
3. **Pomnóż dystans przez spalanie i podziel przez 100** – wyjdzie liczba litrów.
4. **Pomnóż litry przez cenę za litr.** Przy trasie przez kilka krajów policz każdy odcinek po cenie w danym kraju.
5. **Przy przejeździe tam i z powrotem** pomnóż wynik przez dwa, a jeśli jedzie kilka osób – podziel przez ich liczbę.

## Przykłady z aktualnymi cenami

Koszt w jedną stronę przy typowym spalaniu: benzyna 7 l, diesel 6 l, LPG 9 l na 100 km.

{{trips warszawa-krakow warszawa-gdansk wroclaw-poznan krakow-zakopane warszawa-berlin krakow-praga}}

Przy trasach za granicę cena jest ważona kilometrami w każdym kraju – dlatego na przykład trasa Warszawa – Berlin kosztuje więcej, niż wynikałoby z samej polskiej ceny.

## Trasa przez kilka krajów

Jeśli trasa przechodzi przez kilka krajów, liczenie jednej ceną daje błędny wynik. Dokładniej jest podzielić trasę na odcinki: kilometry w każdym kraju × spalanie ÷ 100 × cena w tym kraju, a potem zsumować. Na trasie Warszawa – Berlin {{km warszawa-berlin}} km wypada w dwóch krajach, a średnia cena benzyny ważona kilometrami to {{triprate warszawa-berlin pb}}.

Kalkulator Tankful robi to sam: sprawdza, ile kilometrów trasy wypada w każdym kraju, i bierze aktualną średnią cenę z każdego z nich.

## Najczęstsze błędy

- **Spalanie z katalogu zamiast realnego.** Producent podaje wynik z testu – na autostradzie zwykle wychodzi o 10–30% więcej.
- **Pominięcie drogi powrotnej** albo dojazdów na miejscu.
- **Jedna cena dla całej trasy za granicę**, choć paliwo w sąsiednim kraju bywa droższe albo tańsze o kilkadziesiąt groszy na litrze.
- **Liczenie promu jak drogi.** Na promie auto nie zużywa paliwa – kalkulator pomija takie odcinki, ale przy liczeniu ręcznym łatwo o tym zapomnieć.

Nie chcesz liczyć ręcznie? [Kalkulator Tankful](./) wyznaczy trasę i koszt dla benzyny, diesla, LPG i elektryka, z aktualnymi cenami.
