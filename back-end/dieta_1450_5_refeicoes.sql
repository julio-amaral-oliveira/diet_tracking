-- Carga do plano de 1.450 kcal para o usuário default_user.
-- Restaure o backup.sql primeiro e depois aplique este arquivo.
-- Uso: psql -U bulking_user -d bulking_db -f dieta_1450_5_refeicoes.sql
--
-- Cinco refeições: café da manhã, lanche da manhã, almoço,
-- lanche da tarde e janta.
-- Metas diárias: 1.450 kcal, 122 g de proteína, 120 g de carboidrato,
-- 53 g de gordura. A soma calculada fica perto dessas metas.
-- A carga desativa o plano ativo anterior do usuário.

BEGIN;

UPDATE public.diet_plans
SET is_active = false
WHERE user_id = 'default_user' AND is_active;

INSERT INTO public.diet_plans (
    id, user_id, target_calories, target_protein, target_carbs,
    target_fat, is_active, created_at
)
VALUES (
    2, 'default_user', 1450, 122, 120, 53, true, now()
);

INSERT INTO public.diet_variations (id, diet_plan_id, name, order_index, created_at)
VALUES (5, 2, 'Principal', 0, now());

INSERT INTO public.meals (id, diet_plan_id, name, order_index, variation_id) VALUES
(29, 2, 'Café da manhã', 0, 5),
(30, 2, 'Lanche da manhã', 1, 5),
(31, 2, 'Almoço', 2, 5),
(32, 2, 'Lanche da tarde', 3, 5),
(33, 2, 'Janta', 4, 5);

INSERT INTO public.meal_items (id, meal_id, food_item_id, quantity_grams) VALUES
-- Café da manhã (refeição 29)
(95, 29, (SELECT id FROM public.food_items WHERE name = 'Iogurte natural'), 180),
(96, 29, (SELECT id FROM public.food_items WHERE name = 'Mamão Papaia cru'), 65),
(97, 29, (SELECT id FROM public.food_items WHERE name = 'Queijo minas frescal'), 25),
(98, 29, (SELECT id FROM public.food_items WHERE name = 'Café infusão 10%'), 20),
(99, 29, (SELECT id FROM public.food_items WHERE name = 'Aveia flocos crua'), 15),
-- Lanche da manhã (refeição 30)
(100, 30, (SELECT id FROM public.food_items WHERE name = 'whey 0 lacotse new nutrition'), 25),
(101, 30, (SELECT id FROM public.food_items WHERE name = 'Kiwi cru'), 60),
(102, 30, (SELECT id FROM public.food_items WHERE name = 'Linhaça semente'), 10),
-- Almoço (refeição 31)
(103, 31, (SELECT id FROM public.food_items WHERE name = 'Arroz integral cozido'), 75),
(104, 31, (SELECT id FROM public.food_items WHERE name = 'Feijão carioca cozido'), 105),
(105, 31, (SELECT id FROM public.food_items WHERE name = 'Frango peito sem pele cozido'), 105),
(106, 31, (SELECT id FROM public.food_items WHERE name = 'Cenoura cozida'), 100),
(107, 31, (SELECT id FROM public.food_items WHERE name = 'Beterraba cozida'), 60),
-- Lanche da tarde (refeição 32)
(108, 32, (SELECT id FROM public.food_items WHERE name = 'Tapioca'), 20),
(109, 32, (SELECT id FROM public.food_items WHERE name = 'Requeijão tirolez'), 65),
(110, 32, (SELECT id FROM public.food_items WHERE name = 'Ameixa crua'), 20),
(111, 32, (SELECT id FROM public.food_items WHERE name = 'Morango cru'), 120),
-- Janta (refeição 33)
(112, 33, (SELECT id FROM public.food_items WHERE name = 'Cuscuz de milho cozido com sal'), 65),
(113, 33, (SELECT id FROM public.food_items WHERE name = 'Carne bovina patinho sem gordura grelhado'), 75),
(114, 33, (SELECT id FROM public.food_items WHERE name = 'Ovo de galinha inteiro cozido/10minutos'), 65),
(115, 33, (SELECT id FROM public.food_items WHERE name = 'Cenoura crua'), 65);

SELECT pg_catalog.setval('public.diet_plans_id_seq', 2, true);
SELECT pg_catalog.setval('public.diet_variations_id_seq', 5, true);
SELECT pg_catalog.setval('public.meals_id_seq', 33, true);
SELECT pg_catalog.setval('public.meal_items_id_seq', 115, true);

COMMIT;
